/**
 * Seanime Extension for Scanita
 * Implements MangaProvider interface for 'scanita'.
 */
class Provider {
    constructor() {
        this.api = 'https://scanita.org';
    }

    api = ''; 

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    /**
     * Searches for manga based on a query.
     */
    async search(opts) {
        const queryParam = opts.query;
        const url = `${this.api}/search?q=${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });

            if (!response.ok) return [];

            const text = await response.text();
            let html;

            // Step 1: Handle JSON response that contains escaped HTML
            try {
                const parsed = JSON.parse(text);
                const escapedHtml = parsed.html || parsed;

                html = escapedHtml
                    .replace(/\\u003C/g, '<')
                    .replace(/\\u003E/g, '>')
                    .replace(/\\u0026/g, '&')
                    .replace(/\\"/g, '"');
            } catch {
                html = text; // fallback if it's already plain HTML
            }

            // Step 2: Load and parse HTML
            const doc = LoadDoc(html);
            const mangas = [];

            // Step 3: Extract all manga results
            doc('div.series').each((index, el) => {
                const element = doc(el);

                const linkElement = element.find('a.link-series').first();
                const imgElement = element.find('img').first();

                if (!linkElement.length || !imgElement.length) return;

                const title = linkElement.text().trim();
                const mangaUrlSegment = linkElement.attr('href');
                const mangaId = mangaUrlSegment?.split('/manga/')[1];

                let thumbnailUrl =
                    imgElement.attr('data-src') || imgElement.attr('src');

                // Proxy through Weserv to bypass 403 or optimize delivery
                if (
                    thumbnailUrl &&
                    thumbnailUrl.startsWith('https://cdn.manga-italia.com/')
                ) {
                    thumbnailUrl = `https://images.weserv.nl/?url=${thumbnailUrl.replace(
                        /^https?:\/\//,
                        '',
                    )}`;
                }

                mangas.push({
                    id: mangaId,
                    title,
                    synonyms: undefined,
                    year: undefined,
                    image: thumbnailUrl,
                });
            });

            if (mangas.length === 0) {
                console.warn('No search results found for:', queryParam);
                console.warn('Sample HTML:', html.slice(0, 500));
            }

            return mangas;
        } catch (e) {
            console.error('Search error:', e);
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID.
     */
    async findChapters(mangaId) {
        const url = `${this.api}/manga/${mangaId}`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const body = await response.text();
            const doc = LoadDoc(body);
            const chapters = [];

            const items = doc('div.col-chapter a');

            items.each((index, el) => {
                const element = doc(el);
                const href = element.attr('href'); // e.g. /scan/84477
                const title = element.find('h5').text().trim(); // e.g. "Capitolo 114"
                const date = element.find('div.text-muted').text().trim();

                if (!href) return;

                const chapterId = href.split('/scan/')[1];
                const chapMatch = title.match(/(\d+(\.\d+)?)/);
                const chapterNumber = chapMatch ? chapMatch[0] : '0';

                chapters.push({
                    id: chapterId,
                    url: `${this.api}${href}`,
                    title: `${title} (${date})`,
                    chapter: chapterNumber,
                    index: 0,
                });
            });

            // Sort chapters numerically
            chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            // Reindex
            chapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return chapters;
        } catch (e) {
            console.error('Chapter fetch error:', e);
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     */
    async findChapterPages(chapterId) {
        const url = `${this.api}/scan/${chapterId}`;
        const referer = url;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const body = await response.text();
            const doc = LoadDoc(body);
            const pages = [];

            doc('div.book-page img').each((index, el) => {
                const element = doc(el);
                let imgUrl = element.attr('src');
                if (!imgUrl) return;

                // Proxy through Weserv if needed
                if (imgUrl.startsWith('https://cdn-s.manga-italia.com/')) {
                    imgUrl = `https://images.weserv.nl/?url=${imgUrl.replace(
                        /^https?:\/\//,
                        '',
                    )}`;
                }

                pages.push({
                    url: imgUrl,
                    index,
                    headers: {
                        Referer: referer,
                    },
                });
            });

            // Optional: detect "next page" button
            const nextLink = doc('a.btn-next').attr('href');
            if (nextLink) {
                // Could recursively load /scan/{chapterId}/2, etc.
            }

            return pages;
        } catch (e) {
            console.error('Page fetch error:', e);
            return [];
        }
    }
}
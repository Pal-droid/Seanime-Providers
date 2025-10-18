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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) return [];
            
            const body = await response.text();
            const doc = LoadDoc(body);
            
            let mangas = [];

            const items = doc('div.series');

            items.each((index, element) => {
                const linkElement = element.find('a.link-series').first();
                const imgElement = element.find('img').first();

                if (!linkElement || !imgElement) return;

                const title = linkElement.text().trim();
                const mangaUrlSegment = linkElement.attrs()['href']; // e.g. /manga/tonikaku-kawaii
                const mangaId = mangaUrlSegment.split('/manga/')[1];
                
                let thumbnailUrl = imgElement.attrs()['data-src'] || imgElement.attrs()['src'];
                
                // Proxy through Weserv to bypass 403 or optimize delivery
                if (thumbnailUrl && thumbnailUrl.startsWith('https://cdn.manga-italia.com/')) {
                    thumbnailUrl = `https://images.weserv.nl/?url=${thumbnailUrl.replace(/^https?:\/\//, '')}`;
                }

                mangas.push({
                    id: mangaId,
                    title: title,
                    synonyms: undefined,
                    year: undefined,
                    image: thumbnailUrl,
                });
            });

            return mangas;
        }
        catch (e) {
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
            const body = await response.text();
            const doc = LoadDoc(body);

            let chapters = [];

            const items = doc('div.col-chapter a');

            items.each((index, element) => {
                const href = element.attrs()['href']; // e.g. /scan/84477
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

            // Sort by chapter number
            chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            chapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return chapters;
        }
        catch (e) {
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
            const body = await response.text();
            const doc = LoadDoc(body);
            
            let pages = [];

            // Extract all image URLs in the current page
            doc('div.book-page img').each((index, element) => {
                let imgUrl = element.attrs()['src'];
                if (!imgUrl) return;

                // Proxy through Weserv if needed
                if (imgUrl.startsWith('https://cdn-s.manga-italia.com/')) {
                    imgUrl = `https://images.weserv.nl/?url=${imgUrl.replace(/^https?:\/\//, '')}`;
                }

                pages.push({
                    url: imgUrl,
                    index: index,
                    headers: {
                        'Referer': referer, 
                    },
                });
            });

            // Optional: detect next page button
            const nextLink = doc('a.btn-next').attrs()?.['href'];
            if (nextLink) {
                // Optionally handle pagination here
                // e.g., recursively load /scan/{chapterId}/2, etc.
            }

            return pages;
        }
        catch (e) {
            return [];
        }
    }
}

/**
 * Seanime Extension for MangaKakaLove.
 */
class Provider {

    constructor() {
        this.api = 'https://www.mangakakalove.com';
    }

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    /**
     * Search manga using a query.
     * Uses regex to extract title, id, and thumbnail from search results.
     * Adds Referer header to avoid 403 and proxies thumbnails through weserv.nl.
     */
    async search(opts) {
        const queryParam = opts.query;
        const url = `${this.api}/search/story/${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': this.api,
                }
            });
            if (!response.ok) return [];

            const body = await response.text();
            const mangas = [];

            const regex = /<div class="story_item"[\s\S]*?<a href="(.*?)"[\s\S]*?<img src="(.*?)"[\s\S]*?<h3 class="story_name">[\s\S]*?<a[^>]*>(.*?)<\/a>/g;

            let match;
            while ((match = regex.exec(body)) !== null) {
                const mangaUrl = match[1].trim();
                const imageUrl = match[2].trim();
                const title = match[3].trim();

                const mangaId = mangaUrl.split('/manga/')[1];

                // Proxy thumbnail via weserv
                const strippedUrl = imageUrl.replace(/^https?:\/\//, '');
                const proxiedThumbnailUrl = `https://images.weserv.nl/?url=${strippedUrl}`;

                mangas.push({
                    id: mangaId,
                    title: title,
                    synonyms: undefined,
                    year: undefined,
                    image: proxiedThumbnailUrl,
                });
            }

            return mangas;
        } catch (e) {
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID.
     * Chapters appear newest to oldest, so we reverse the list for ascending order.
     */
    async findChapters(mangaId) {
        const url = `${this.api}/manga/${mangaId}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': this.api,
                }
            });
            const body = await response.text();

            const chapters = [];

            const regex = /<div class="row">\s*<span><a href="(.*?)"[^>]*>(.*?)<\/a><\/span>/g;

            let match;
            while ((match = regex.exec(body)) !== null) {
                const chapterUrl = match[1].trim();
                const title = match[2].trim();
                const chapterId = chapterUrl.split('/').pop();

                const chapMatch = title.match(/Chapter\s+([\d.]+)/i);
                const chapterNumber = chapMatch ? chapMatch[1] : '0';

                chapters.push({
                    id: chapterId,
                    url: chapterUrl,
                    title: title,
                    chapter: chapterNumber,
                    index: 0,
                });
            }

            // Sort by chapter number (ascending)
            chapters.reverse().forEach((chapter, i) => {
                chapter.index = i;
            });

            return chapters;
        } catch (e) {
            return [];
        }
    }

    /**
     * Finds and parses image URLs for a given chapter ID.
     * Extracts from `chapterImages` JS array using regex.
     */
    async findChapterPages(chapterId) {
        const url = `${this.api}/manga/${chapterId}`;
        const referer = this.api;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': referer,
                }
            });
            const body = await response.text();

            const cdnMatch = body.match(/var cdns = \["(.*?)"/);
            const cdn = cdnMatch ? cdnMatch[1].replace(/\\\//g, '/') : '';

            const imgArrayMatch = body.match(/var chapterImages = \[(.*?)\]/);
            if (!imgArrayMatch) return [];

            const imagePaths = imgArrayMatch[1]
                .split(',')
                .map(s => s.replace(/["'\\\s]/g, '').trim())
                .filter(Boolean);

            const pages = imagePaths.map((path, index) => ({
                url: `${cdn}${path}`,
                index: index,
                headers: {
                    'Referer': referer,
                },
            }));

            return pages;
        } catch (e) {
            return [];
        }
    }
}
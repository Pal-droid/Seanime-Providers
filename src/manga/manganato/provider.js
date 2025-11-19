/**
 * Seanime Extension for MangaKakalove
 * Implements MangaProvider interface for 'https://www.mangakakalove.com'.
 */
class Provider {

    constructor() {
        this.api = 'https://www.mangakakalove.com';
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
        // MangaKakalove uses path-based search where spaces are usually replaced by underscores
        const queryParam = opts.query.trim().replace(/\s+/g, '_');
        const url = `${this.api}/search/story/${queryParam}`;

        try {
            const response = await fetch(url);

            if (!response.ok) return [];

            const body = await response.text();
            const doc = LoadDoc(body);

            let mangas = [];

            const items = doc('div.story_item');

            items.each((index, element) => {
                const titleElement = element.find('h3.story_name a').first();
                const imageElement = element.find('img').first();

                const title = titleElement.text().trim();
                const href = titleElement.attrs()['href'];
                
                // Extract ID from URL (e.g., https://www.mangakakalove.com/manga/nisekoi -> nisekoi)
                const mangaId = href.split('/').pop();
                
                const thumbnailUrl = imageElement.attrs()['src'];

                mangas.push({
                    id: mangaId,
                    title: title,
                    synonyms: undefined,
                    year: undefined,
                    image: thumbnailUrl,
                });
            });

            return mangas;
        } catch (e) {
            console.error(e);
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

            // Helper to extract numbers from titles
            const extractChapterNumber = (text) => {
                const match = text.match(/Chapter\s+(\d+(\.\d+)?)/i);
                return match ? match[1] : '0';
            };

            // The site lists chapters in div.row elements
            doc('div.row').each((index, element) => {
                const linkElement = element.find('span a').first();
                
                if (linkElement && linkElement.attrs && linkElement.attrs()['href']) {
                    const fullUrl = linkElement.attrs()['href'];
                    const title = linkElement.text().trim();
                    
                    // We construct the ID as the path relative to the API to make findChapterPages easier
                    // e.g., https://www.mangakakalove.com/manga/nisekoi/chapter-229-7 
                    // -> manga/nisekoi/chapter-229-7
                    const urlObj = new URL(fullUrl);
                    const chapterId = urlObj.pathname.substring(1); // Remove leading slash

                    chapters.push({
                        id: chapterId,
                        url: fullUrl,
                        title: title,
                        chapter: extractChapterNumber(title),
                        index: 0,
                    });
                }
            });

            // Remove duplicates
            const uniqueChapters = Array.from(new Set(chapters.map(c => c.id)))
                .map(id => chapters.find(c => c.id === id));

            // Sort by chapter number (ascending)
            uniqueChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            // Re-index
            uniqueChapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return uniqueChapters;
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     */
    async findChapterPages(chapterId) {
        // chapterId is the relative path: manga/{mangaId}/{chapterId}
        const url = `${this.api}/${chapterId}`;

        try {
            const response = await fetch(url);
            const body = await response.text();
            
            let pages = [];

            // The images are defined in JS variables inside the HTML
            // var cdns = ["..."];
            // var chapterImages = ["path/1.webp", ...];

            const cdnMatch = body.match(/var\s+cdns\s*=\s*(\[[^\]]+\])/);
            const imagesMatch = body.match(/var\s+chapterImages\s*=\s*(\[[^\]]+\])/);

            if (cdnMatch && imagesMatch) {
                // Parse the JSON arrays
                const cdns = JSON.parse(cdnMatch[1]);
                const chapterImages = JSON.parse(imagesMatch[1]);

                if (Array.isArray(cdns) && cdns.length > 0 && Array.isArray(chapterImages)) {
                    const baseUrl = cdns[0]; // Usually use the first CDN

                    chapterImages.forEach((imgData, index) => {
                        // Construct full URL
                        const fullUrl = baseUrl + imgData;

                        pages.push({
                            url: fullUrl,
                            index: index,
                            headers: {
                                'Referer': url,
                            },
                        });
                    });
                }
            }

            return pages;
        } catch (e) {
            console.error(e);
            return [];
        }
    }
}

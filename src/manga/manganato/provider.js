/**
 * Seanime Extension for MangaKakalove and mirrors
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

                // Defensive check to ensure elements exist
                if (titleElement.length === 0) return;

                const title = titleElement.text().trim();
                let href = titleElement.attrs()['href'];
                
                // Handle trailing slashes in URL to ensure ID is extracted correctly
                if (href.endsWith('/')) {
                    href = href.slice(0, -1);
                }
                const mangaId = href.split('/').pop();
                
                let thumbnailUrl = '';
                if (imageElement.length > 0) {
                    thumbnailUrl = imageElement.attrs()['src'];
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
            if (!response.ok) return []; // Safety check for response

            const body = await response.text();
            const doc = LoadDoc(body);

            let chapters = [];

            const extractChapterNumber = (text) => {
                const match = text.match(/Chapter\s+(\d+(\.\d+)?)/i);
                return match ? match[1] : '0';
            };

            // Use a more specific selector to avoid stray 'row' divs
            doc('div.chapter-list div.row').each((index, element) => {
                const linkElements = element.find('span a');
                
                // Check length before proceeding to avoid panic
                if (linkElements.length === 0) return;

                // Iterate safely instead of assuming .first() works on potential empty set
                linkElements.each((i, link) => {
                    // We only want the first link in the row, effectively acting as .first()
                    if (i > 0) return;

                    if (link.attrs && link.attrs()['href']) {
                        const fullUrl = link.attrs()['href'];
                        const title = link.text().trim();
                        
                        const urlObj = new URL(fullUrl);
                        const chapterId = urlObj.pathname.substring(1); 

                        chapters.push({
                            id: chapterId,
                            url: fullUrl,
                            title: title,
                            chapter: extractChapterNumber(title),
                            index: 0,
                        });
                    }
                });
            });

            const uniqueChapters = Array.from(new Set(chapters.map(c => c.id)))
                .map(id => chapters.find(c => c.id === id));

            uniqueChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

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

            const cdnMatch = body.match(/var\s+cdns\s*=\s*(\[[^\]]+\])/);
            const imagesMatch = body.match(/var\s+chapterImages\s*=\s*(\[[^\]]+\])/);

            if (cdnMatch && imagesMatch) {
                const cdns = JSON.parse(cdnMatch[1]);
                const chapterImages = JSON.parse(imagesMatch[1]);

                if (Array.isArray(cdns) && cdns.length > 0 && Array.isArray(chapterImages)) {
                    const baseUrl = cdns[0]; 

                    chapterImages.forEach((imgData, index) => {
                        // Prevent double slashes (e.g. host.com/ + /path -> host.com//path)
                        // Some CDNs reject double slashes.
                        let fullUrl;
                        if (baseUrl.endsWith('/') && imgData.startsWith('/')) {
                            fullUrl = baseUrl + imgData.substring(1);
                        } else if (!baseUrl.endsWith('/') && !imgData.startsWith('/')) {
                            fullUrl = baseUrl + '/' + imgData;
                        } else {
                            fullUrl = baseUrl + imgData;
                        }

                        pages.push({
                            url: fullUrl,
                            index: index,
                            headers: {
                                'Referer': 'https://www.mangakakalove.com/',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' 
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

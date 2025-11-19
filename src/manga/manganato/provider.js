/**
 * Seanime Extension for MangaKakalove and mirrors
 */
class Provider {

    /**
     * @param {Object} config - User configuration from manifest.json
     */
    constructor(config) {
        this.api = 'https://www.mangakakalove.com';

        // Remove trailing slash if present to accept both formats safely
        if (this.api.endsWith('/')) {
            this.api = this.api.slice(0, -1);
        }
    }

    api = '';

    /**
     * Helper to get consistent headers for all requests
     */
    getHeaders() {
        return {
            'Referer': `${this.api}/`, // Always send domain with trailing slash
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        };
    }

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
        const queryParam = opts.query
            .trim()
            .replace(/_/g, ' ')             // Treat existing underscores as spaces
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove non-alphanumeric chars
            .replace(/\s+/g, '%20');        // Replace spaces with '%20'
            
        const url = `${this.api}/search/story/${queryParam}`;

        try {
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) return [];

            const body = await response.text();
            const doc = LoadDoc(body);

            let mangas = [];

            const items = doc('div.story_item');

            items.each((index, element) => {
                const titleElement = element.find('h3.story_name a').first();
                const imageElement = element.find('img').first();

                if (titleElement.length === 0) return;

                const title = titleElement.text().trim();
                let href = titleElement.attrs()['href'];
                
                if (href.endsWith('/')) {
                    href = href.slice(0, -1);
                }
                const mangaId = href.split('/').pop();
                
                let thumbnailUrl = '';
                
                // 1. Try standard extraction (Prioritize 'src' based on your snippet)
                if (imageElement.length > 0) {
                    const attrs = imageElement.attrs();
                    // We check src first because your snippet shows the data is there
                    thumbnailUrl = attrs['src'];
                    
                    // Fallbacks for lazy loading if src is empty or placeholder
                    if (!thumbnailUrl || thumbnailUrl.includes('404-avatar')) {
                        thumbnailUrl = attrs['data-src'] || attrs['data-original'];
                    }
                }

                // 2. Fallback: Regex extraction on the raw HTML of the item
                // This bypasses the parser if malformed attributes (like unclosed alt tags) confused it
                if (!thumbnailUrl) {
                    const html = element.html() || '';
                    // Look for src="http..." pattern specifically
                    const srcMatch = html.match(/src\s*=\s*["']([^"']+)["']/i);
                    if (srcMatch) {
                        thumbnailUrl = srcMatch[1];
                    }
                }

                mangas.push({
                    id: mangaId,
                    title: title,
                    synonyms: undefined,
                    year: undefined,
                    image: thumbnailUrl,
                    headers: this.getHeaders() // Use this.getHeaders() directly for each item
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
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) return [];

            const body = await response.text();
            const doc = LoadDoc(body);

            let chapters = [];

            const extractChapterNumber = (text) => {
                const match = text.match(/Chapter\s+(\d+(\.\d+)?)/i);
                return match ? match[1] : '0';
            };

            doc('div.chapter-list div.row').each((index, element) => {
                const linkElements = element.find('span a');
                
                if (linkElements.length === 0) return;

                linkElements.each((i, link) => {
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
        const url = `${this.api}/${chapterId}`;

        try {
            const response = await fetch(url, {
                headers: this.getHeaders()
            });
            
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
                            headers: this.getHeaders()
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

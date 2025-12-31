class Provider {
    constructor() {
        this.api = 'https://www.mangabats.com';
        this.proxyBase = 'http://localhost:43211/api/v1/image-proxy';
    }

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    /**
     * Helper to wrap URLs in the proxy with Referer headers.
     */
    applyProxy(targetUrl) {
        const headers = JSON.stringify({ "Referer": `${this.api}/` });
        return `${this.proxyBase}?url=${encodeURIComponent(targetUrl)}&headers=${encodeURIComponent(headers)}`;
    }

    /**
     * Searches for manga.
     */
    async search(opts) {
        const queryParam = opts.query.replace(/\s+/g, '_');
        const url = `${this.api}/search/story/${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Referer': this.api,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const body = await response.text();
            let mangas = [];

            const itemRegex = /<div class="story_item"[\s\S]*?<\/h3>/g;
            const detailRegex = /<a href="[^"]*\/manga\/([^"]+)"[\s\S]*?src="([^"]+)"[\s\S]*?class="story_name">[\s\S]*?>([^<]+)<\/a>/;

            let match;
            while ((match = itemRegex.exec(body)) !== null) {
                const details = detailRegex.exec(match[0]);
                if (details) {
                    const originalImageUrl = details[2];
                    mangas.push({
                        id: details[1],
                        title: details[3].trim(),
                        // Apply the proxy 
                        image: this.applyProxy(originalImageUrl)
                    });
                }
            }
            return mangas;
        } catch (e) {
            return [];
        }
    }

    /**
     * Parses chapters from the list, ensuring logical numerical order.
     */
    async findChapters(mangaId) {
        const url = `${this.api}/manga/${mangaId}`;

        try {
            const response = await fetch(url, {
                headers: { 'Referer': this.api }
            });
            const body = await response.text();
            
            const listMatch = body.match(/<div class="chapter-list">([\s\S]*?)<\/div>\s*<\/div>/);
            const content = listMatch ? listMatch[1] : body;

            let chapters = [];
            const chapterRegex = /<a href="https:\/\/www\.mangabats\.com\/([^"]+)"[^>]*>Chapter\s+([\d.]+)<\/a>/g;

            let match;
            while ((match = chapterRegex.exec(content)) !== null) {
                chapters.push({
                    id: match[1],
                    url: `${this.api}/${match[1]}`,
                    title: `Chapter ${match[2]}`,
                    chapter: match[2],
                });
            }

            return chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter))
                           .map((chap, index) => ({ ...chap, index }));
        } catch (e) {
            return [];
        }
    }

    /**
     * Extracts chapter images and sets the site URL as Referer.
     */
    async findChapterPages(chapterId) {
        const url = `${this.api}/${chapterId}`;

        try {
            const response = await fetch(url, {
                headers: { 
                    'Referer': this.api,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!response.ok) return [];
            
            const body = await response.text();

            const cdnsRaw = body.match(/var\s+cdns\s*=\s*\[([\s\S]*?)\];/i);
            const imagesRaw = body.match(/var\s+chapterImages\s*=\s*\[([\s\S]*?)\];/i);

            if (!cdnsRaw || !imagesRaw) return [];

            const clean = (str) => str.split(',')
                .map(s => s.trim().replace(/^["']|["']$/g, '').replace(/\\/g, ''))
                .filter(Boolean);

            const cdns = clean(cdnsRaw[1]);
            const imagePaths = clean(imagesRaw[1]);
            const baseCdn = cdns[0];

            return imagePaths.map((path, index) => {
                const fullUrl = path.startsWith('http') ? path : `${baseCdn}${path}`;
                return {
                    url: fullUrl,
                    index: index,
                    headers: { 'Referer': `${this.api}/` } 
                };
            });
        } catch (e) {
            return [];
        }
    }
}

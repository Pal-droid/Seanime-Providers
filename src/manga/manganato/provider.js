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

            // Match each story_item div
            const itemRegex = /<div class="story_item"[\s\S]*?<\/div>\s*<\/div>/g;
            
            let match;
            while ((match = itemRegex.exec(body)) !== null) {
                const itemHtml = match[0];
                
                // Extract manga ID from the href attribute
                const idMatch = itemHtml.match(/href="https:\/\/www\.mangabats\.com\/manga\/([^"]+)"/);
                if (!idMatch) continue;
                
                const mangaId = idMatch[1];
                
                // Extract image URL from img src
                const imgMatch = itemHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/);
                const imageUrl = imgMatch ? imgMatch[1] : '';
                
                // Extract title from story_name
                const titleMatch = itemHtml.match(/class="story_name"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);
                if (!titleMatch) continue;
                
                const title = titleMatch[1].trim();
                
                mangas.push({
                    id: mangaId,
                    title: title,
                    image: imageUrl ? this.applyProxy(imageUrl) : ''
                });
            }
            
            return mangas;
        } catch (e) {
            console.error('Search error:', e);
            return [];
        }
    }

    /**
     * Parses chapters from the API endpoint.
     */
    async findChapters(mangaId) {
        // Clean mangaId - remove trailing slash if present
        const cleanMangaId = mangaId.replace(/\/$/, '');
        const url = `${this.api}/api/manga/${cleanMangaId}/chapters?limit=50000&offset=0`;

        try {
            const response = await fetch(url, {
                headers: { 
                    'Referer': `${this.api}/manga/${cleanMangaId}`,
                    'Origin': this.api,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!response.ok) {
                console.error(`API request failed with status ${response.status}`);
                // Try alternative URL pattern
                return await this.findChaptersAlternative(mangaId);
            }
            
            const data = await response.json();
            console.log('API Response:', data); // Debug log
            
            // Try different JSON structures
            let chapters = [];
            
            // Structure 1: data.chapters array
            if (data.success && data.data && Array.isArray(data.data.chapters)) {
                chapters = data.data.chapters.map((chapter, index) => {
                    const chapterNum = chapter.chapter_num || chapter.chapter_num || '0';
                    return {
                        id: `manga/${cleanMangaId}/${chapter.chapter_slug}`,
                        url: `${this.api}/manga/${cleanMangaId}/${chapter.chapter_slug}`,
                        title: chapter.chapter_name || `Chapter ${chapterNum}`,
                        chapter: chapterNum.toString(),
                        index: index
                    };
                });
            }
            // Structure 2: data is an array directly
            else if (data.data && Array.isArray(data.data)) {
                chapters = data.data.map((chapter, index) => {
                    const chapterNum = chapter.attributes?.chapter || chapter.chapter || '0';
                    const chapterSlug = chapter.id ? `chapter/${chapter.id}` : `chapter-${chapterNum}`;
                    return {
                        id: `manga/${cleanMangaId}/${chapterSlug}`,
                        url: `${this.api}/manga/${cleanMangaId}/${chapterSlug}`,
                        title: chapter.attributes?.title || `Chapter ${chapterNum}`,
                        chapter: chapterNum.toString(),
                        index: index
                    };
                });
            }
            // Structure 3: chapters array at root
            else if (data.chapters && Array.isArray(data.chapters)) {
                chapters = data.chapters.map((chapter, index) => {
                    const chapterNum = chapter.chapter_num || chapter.chapter || '0';
                    return {
                        id: `manga/${cleanMangaId}/${chapter.chapter_slug || `chapter-${chapterNum}`}`,
                        url: `${this.api}/manga/${cleanMangaId}/${chapter.chapter_slug || `chapter-${chapterNum}`}`,
                        title: chapter.chapter_name || `Chapter ${chapterNum}`,
                        chapter: chapterNum.toString(),
                        index: index
                    };
                });
            }
            // Structure 4: Try to scrape from HTML if API fails
            else {
                console.log('JSON structure not recognized, trying HTML scraping...');
                return await this.scrapeChaptersFromHTML(cleanMangaId);
            }
            
            // Sort by chapter number in descending order (newest first)
            return chapters.sort((a, b) => {
                const aNum = parseFloat(a.chapter) || 0;
                const bNum = parseFloat(b.chapter) || 0;
                return bNum - aNum; // Descending order
            });
            
        } catch (e) {
            console.error('Error fetching chapters from API:', e);
            // Fallback to HTML scraping
            return await this.findChaptersAlternative(mangaId);
        }
    }

    /**
     * Alternative method to scrape chapters from HTML if API fails
     */
    async findChaptersAlternative(mangaId) {
        const cleanMangaId = mangaId.replace(/\/$/, '');
        const url = `${this.api}/manga/${cleanMangaId}`;

        try {
            const response = await fetch(url, {
                headers: { 
                    'Referer': this.api,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            const body = await response.text();
            let chapters = [];
            
            // Try to find chapter list in HTML
            const chapterListMatch = body.match(/<div class="chapter-list"[\s\S]*?<\/div>\s*<\/div>/);
            if (chapterListMatch) {
                const chapterListHtml = chapterListMatch[0];
                const chapterRegex = /<a href="https:\/\/www\.mangabats\.com\/(manga\/[^"]+)"[^>]*>Chapter\s+([\d.]+)<\/a>/g;
                
                let match;
                while ((match = chapterRegex.exec(chapterListHtml)) !== null) {
                    chapters.push({
                        id: match[1],
                        url: `${this.api}/${match[1]}`,
                        title: `Chapter ${match[2]}`,
                        chapter: match[2],
                    });
                }
            }
            
            // If not found, try alternative pattern
            if (chapters.length === 0) {
                const altChapterRegex = /<a href="\/manga\/[^"]+\/(chapter-\d+)"[^>]*>Chapter\s+([\d.]+)<\/a>/g;
                let altMatch;
                while ((altMatch = altChapterRegex.exec(body)) !== null) {
                    chapters.push({
                        id: `manga/${cleanMangaId}/${altMatch[1]}`,
                        url: `${this.api}/manga/${cleanMangaId}/${altMatch[1]}`,
                        title: `Chapter ${altMatch[2]}`,
                        chapter: altMatch[2],
                    });
                }
            }
            
            return chapters.sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));
            
        } catch (e) {
            console.error('Error scraping chapters from HTML:', e);
            return [];
        }
    }

    /**
     * Scrape chapters from HTML (fallback method)
     */
    async scrapeChaptersFromHTML(mangaId) {
        const url = `${this.api}/manga/${mangaId}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Referer': this.api,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            const body = await response.text();
            const chapters = [];
            
            // Look for chapter links in the page
            const chapterPattern = /<a[^>]*href="\/manga\/[^"]+\/(chapter-\d+)"[^>]*>Chapter\s+([\d.]+)<\/a>/g;
            let match;
            
            while ((match = chapterPattern.exec(body)) !== null) {
                chapters.push({
                    id: `manga/${mangaId}/${match[1]}`,
                    url: `${this.api}/manga/${mangaId}/${match[1]}`,
                    title: `Chapter ${match[2]}`,
                    chapter: match[2],
                });
            }
            
            // Sort by chapter number (descending)
            return chapters.sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));
            
        } catch (e) {
            console.error('Error in scrapeChaptersFromHTML:', e);
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

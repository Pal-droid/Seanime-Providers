/**
 * Seanime Extension for MangaFreak
 * Implements MangaProvider interface for 'https://ww2.mangafreak.me'.
 */
class Provider {

    constructor() {
        this.api = 'https://ww2.mangafreak.me';
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
     * Proxies thumbnail images through weserv.nl.
     */
    async search(opts) {
        const queryParam = opts.query;
        const url = `${this.api}/Find/${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url, {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });

            if (!response.ok) return [];
            
            const body = await response.text();
            const doc = LoadDoc(body);
            
            let mangas = [];

            const items = doc('div.search_result div.manga_search_item');
            
            items.each((index, element) => {
                const titleElement = element.find('h3 a').first();
                const imageElement = element.find('img').first();

                const title = titleElement.text().trim();
                const mangaUrlSegment = titleElement.attrs()['href'];
                const mangaId = mangaUrlSegment.split('/Manga/')[1];
                const originalThumbnailUrl = imageElement.attrs()['src']; // Original image URL
                
                // Strip protocol for weserv
                const strippedUrl = originalThumbnailUrl.replace(/^https?:\/\//, '');

                // Proxy through weserv
                const proxiedThumbnailUrl = `https://images.weserv.nl/?url=${strippedUrl}`;

                mangas.push({
                    id: mangaId,
                    title: title,
                    synonyms: undefined,
                    year: undefined,
                    image: proxiedThumbnailUrl, // Use proxied URL here
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
        const url = `${this.api}/Manga/${mangaId}`;

        try {
            const response = await fetch(url);
            const body = await response.text();
            const doc = LoadDoc(body);

            let chapters = [];

            const extractChapterDetails = (linkElement) => {
                const fullUrl = linkElement.attrs()['href'];
                const titleWithDate = linkElement.text().trim();
                const chapterId = fullUrl.split('/')[1];

                const titleParts = titleWithDate.split(' - ');
                let chapterNumber = '0';
                if (titleParts.length > 0) {
                    const chapMatch = titleParts[0].match(/(\d+(\.\d+)?)/);
                    if (chapMatch) chapterNumber = chapMatch[0];
                }

                return {
                    id: chapterId,
                    url: `${this.api}${fullUrl}`,
                    title: titleWithDate,
                    chapter: chapterNumber,
                    index: 0,
                };
            };

            // 1. Main chapter list
            doc('div.manga_series_list table tr').each((index, element) => {
                if (index === 0) return; 
                const linkElement = element.find('td:first-child a').first();
                if (linkElement && linkElement.attrs && linkElement.attrs()['href']) {
                    chapters.push(extractChapterDetails(linkElement));
                }
            });

            // 2. Latest chapters list
            doc('div.series_sub_chapter_list div a').each((index, element) => {
                const linkElement = element;
                if (linkElement && linkElement.attrs && linkElement.attrs()['href']) {
                    chapters.push(extractChapterDetails(linkElement));
                }
            });

            // Remove duplicates and sort
            const uniqueChapters = Array.from(new Set(chapters.map(c => c.id)))
                .map(id => chapters.find(c => c.id === id));

            uniqueChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            uniqueChapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return uniqueChapters;
        }
        catch (e) {
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     */
    async findChapterPages(chapterId) {
        const url = `${this.api}/${chapterId}`;
        const referer = url; 

        try {
            const response = await fetch(url);
            const body = await response.text();
            const doc = LoadDoc(body);
            
            let pages = [];

            doc('div.mySlides.fade img').each((index, element) => {
                const imgUrl = element.attrs()['src']; // Use direct image URL

                pages.push({
                    url: imgUrl,
                    index: index,
                    headers: {
                        'Referer': referer, // Still set this in fetch requests if needed
                    },
                });
            });

            return pages;
        }
        catch (e) {
            return [];
        }
    }
}

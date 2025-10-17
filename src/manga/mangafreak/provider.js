/**
 * Seanime Extension for MangaFreak
 * Implements MangaProvider interface for 'https://ww2.mangafreak.me'.
 */
class Provider {

    // Define the API base URL in the constructor for maximum JavaScript compatibility.
    constructor() {
        this.api = 'https://ww2.mangafreak.me';
    }

    // Property to hold the API URL.
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
        const url = `${this.api}/Find/${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url, {
                // Critical header to prevent 403 Forbidden errors from the server.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });

            if (!response.ok) {
                 return [];
            }
            
            const body = await response.text();
            const doc = LoadDoc(body);
            
            let mangas = [];

            // Selector for search results: div.manga_search_item within div.search_result
            const items = doc('div.search_result div.manga_search_item');
            
            items.each((index, element) => {
                const titleElement = element.find('h3 a').first();
                const imageElement = element.find('img').first();

                const title = titleElement.text().trim();
                // Extract Manga ID (e.g., 'Nisekoi') from the URL segment (/Manga/Nisekoi)
                const mangaUrlSegment = titleElement.attrs()['href'];
                const mangaId = mangaUrlSegment.split('/Manga/')[1];
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
        }
        catch (e) {
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID.
     * Combines chapters from both the main table and the separate latest chapters list.
     */
    async findChapters(mangaId) {
        const url = `${this.api}/Manga/${mangaId}`;

        try {
            const response = await fetch(url);
            const body = await response.text();
            const doc = LoadDoc(body);

            let chapters = [];
            
            // Helper function to extract and standardize chapter data from an anchor element
            const extractChapterDetails = (linkElement) => {
                const fullUrl = linkElement.attrs()['href'];
                const titleWithDate = linkElement.text().trim();
                const chapterId = fullUrl.split('/')[1];

                // Extract chapter number (e.g., '1' from "Chapter 1 - Promise" or "Chapter 1")
                const titleParts = titleWithDate.split(' - ');
                let chapterNumber = '0';
                
                if (titleParts.length > 0) {
                    const chapMatch = titleParts[0].match(/(\d+(\.\d+)?)/);
                    if (chapMatch) {
                        chapterNumber = chapMatch[0];
                    }
                }
                
                return {
                    id: chapterId,
                    url: `${this.api}${fullUrl}`,
                    title: titleWithDate,
                    chapter: chapterNumber,
                    index: 0, // Temp index
                };
            };


            // 1. SCRAPE MAIN CHAPTER LIST (Chapters in the large table)
            // Selector: All <tr> inside the table within div.manga_series_list
            doc('div.manga_series_list table tr').each((index, element) => {
                // Skip the header row (index 0)
                if (index === 0) return; 

                // The link is in the first <td> within the <tr>
                const linkElement = element.find('td:first-child a').first();
                
                if (linkElement && linkElement.attrs && linkElement.attrs()['href']) {
                    chapters.push(extractChapterDetails(linkElement));
                }
            });


            // 2. SCRAPE LATEST CHAPTERS LIST (Separate list, usually above the main table)
            // Selector: All <a> tags inside <div> tags within div.series_sub_chapter_list
            doc('div.series_sub_chapter_list div a').each((index, element) => {
                const linkElement = element; // The 'a' tag is the element itself
                
                if (linkElement && linkElement.attrs && linkElement.attrs()['href']) {
                    chapters.push(extractChapterDetails(linkElement));
                }
            });
            
            
            // 3. Process and Finalize for Seanime API

            // Remove duplicates (in case a chapter appears in both lists)
            const uniqueChapters = Array.from(new Set(chapters.map(c => c.id)))
                .map(id => chapters.find(c => c.id === id));

            // Sort chapters numerically by chapter number for correct indexing
            uniqueChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            // Re-index all unique chapters sequentially (0, 1, 2...) for Seanime's required index property
            uniqueChapters.forEach((chapter, i) => {
                chapter.index = i;
            });
            
            return uniqueChapters;
        }
        catch (e) {
            // Return empty array on failure
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

            // Selector for the image elements: all <img> inside div.mySlides.fade
            doc('div.mySlides.fade img').each((index, element) => {
                pages.push({
                    url: element.attrs()['src'],
                    index: index,
                    headers: {
                        // Set the Referer header to the chapter page URL (required by some hosts)
                        'Referer': referer, 
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

/**
 * Seanime Extension for Komiku
 * Implements MangaProvider interface for 'https://komiku.org'.
 */
class Provider {

    constructor() {
        // Base URL for manga and chapter pages
        this.api = 'https://komiku.org';
        // Special subdomain for search
        this.searchApi = 'https://api.komiku.org';
    }

    api = 'https://komiku.org';
    searchApi = 'https://api.komiku.org';

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
        const url = `${this.searchApi}/?post_type=manga&s=${encodeURIComponent(queryParam)}`;

        console.log(`[Komiku] search: Starting search for query: "${queryParam}"`);
        console.log(`[Komiku] search: Fetching URL: ${url}`);

        try {
            const response = await fetch(url, {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });

            console.log(`[Komiku] search: Response status: ${response.status}`);

            if (!response.ok) {
                console.error(`[Komiku] search: Request failed. Status: ${response.status} ${response.statusText}`);
                return [];
            }

            const body = await response.text();
            console.log(`[Komiku] search: Received body (length: ${body.length})`);
            
            const doc = LoadDoc(body);
            if (!doc) {
                console.error("[Komiku] search: LoadDoc(body) returned null or undefined.");
                return [];
            }
            console.log("[Komiku] search: Document loaded.");

            let mangas = [];
          
            const items = doc('div.bge');

            console.log(`[Komiku] search: Found ${items.length} elements with selector "div.bge".`);

            items.each((index, element) => {
                console.log(`[Komiku] search: Processing item ${index}...`);
                
                const linkElement = element.find('div.kan a').first();
                const titleElement = element.find('div.kan h3').first();
                const imageElement = element.find('div.bgei img').first();

                if (!linkElement.length || !linkElement.attrs || !linkElement.attrs()['href']) {
                    console.warn(`[Komiku] search: Item ${index} missing link element or href.`);
                    return; // Skip
                }
                
                const mangaUrlSegment = linkElement.attrs()['href'];
                
                // Filter out non-manga links explicitly
                if (!mangaUrlSegment.includes('/manga/')) {
                    console.log(`[Komiku] search: Item ${index} skipped, not a manga link (URL: ${mangaUrlSegment}).`);
                    return;
                }

                if (!titleElement.length) {
                    console.warn(`[Komiku] search: Item ${index} missing title element.`);
                    return; // Skip
                }

                if (!imageElement.length || !imageElement.attrs || !imageElement.attrs()['src']) {
                    console.warn(`[Komiku] search: Item ${index} missing image element or src.`);
                    return; // Skip
                }

                const title = titleElement.text().trim();
                const mangaId = mangaUrlSegment.split('/manga/')[1]?.replace(/\/$/, ''); // Remove trailing slash
                const thumbnailUrl = imageElement.attrs()['src'];

                if (mangaId && title) {
                    console.log(`[Komiku] search: Parsed Manga - ID: ${mangaId}, Title: ${title}`);
                    mangas.push({
                        id: mangaId,
                        title: title,
                        synonyms: undefined,
                        year: undefined,
                        image: thumbnailUrl, 
                    });
                } else {
                    console.warn(`[Komiku] search: Item ${index} skipped, could not parse mangaId or title. Title: ${title}, URL: ${mangaUrlSegment}`);
                }
            });

            console.log(`[Komiku] search: Successfully parsed ${mangas.length} mangas.`);
            return mangas;
        }
        catch (e) {
            console.error(`[Komiku] search: CRITICAL ERROR: ${e.message}`);
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID.
     */
    async findChapters(mangaId) {
        const url = `${this.api}/manga/${mangaId}`;
        console.log(`[Komiku] findChapters: Fetching chapters for Manga ID: ${mangaId} at URL: ${url}`);

        try {
            const response = await fetch(url);
            console.log(`[Komiku] findChapters: Response status: ${response.status}`);

            if (!response.ok) {
                console.error(`[Komiku] findChapters: Request failed. Status: ${response.status}`);
                return [];
            }

            const body = await response.text();
            console.log(`[Komiku] findChapters: Received body (length: ${body.length})`);
            
            const doc = LoadDoc(body);
            if (!doc) {
                console.error("[Komiku] findChapters: LoadDoc(body) returned null or undefined.");
                return [];
            }
            console.log("[Komiku] findChapters: Document loaded.");

            let chapters = [];

            const extractChapterDetails = (linkElement) => {
                const fullUrl = linkElement.attrs()['href']; // e.g., "/nisekoi-chapter-230-6/"
                const title = linkElement.find('span').text().trim(); // e.g., "Chapter 230.6"
                
                if (!fullUrl || !title) {
                    console.warn("[Komiku] findChapters: Skipping chapter, missing URL or title text.");
                    return null;
                }

                // Create ID from relative URL, e.g., "nisekoi-chapter-230-6"
                const chapterId = fullUrl.substring(1).replace(/\/$/, '');

                let chapterNumber = '0';
                if (title) {
                    // Extract number from title
                    const chapMatch = title.match(/(\d+(\.\d+)?)/);
                    if (chapMatch) chapterNumber = chapMatch[0];
                }

                return {
                    id: chapterId,
                    url: `${this.api}${fullUrl}`, // Create absolute URL
                    title: title,
                    chapter: chapterNumber,
                    index: 0,
                };
            };

            // Find all links in the 'judulseries' table cells
            const chapterLinks = doc('td.judulseries a');
            console.log(`[Komiku] findChapters: Found ${chapterLinks.length} elements with selector "td.judulseries a".`);

            chapterLinks.each((index, element) => {
                if (element && element.attrs && element.attrs()['href']) {
                    const chapterDetails = extractChapterDetails(element);
                    if (chapterDetails) {
                        console.log(`[Komiku] findChapters: Parsed Chapter - ID: ${chapterDetails.id}, Title: ${chapterDetails.title}`);
                        chapters.push(chapterDetails);
                    }
                }
            });

            // 2. Remove duplicates and sort
            const uniqueChapters = Array.from(new Set(chapters.map(c => c.id)))
                .map(id => chapters.find(c => c.id === id));
            console.log(`[Komiku] findChapters: Found ${uniqueChapters.length} unique chapters.`);

            // Sort by chapter number (float conversion handles "10.5" vs "10")
            uniqueChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            // Re-assign index based on sorted order
            uniqueChapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return uniqueChapters;
        }
        catch (e) {
            console.error(`[Komiku] findChapters: CRITICAL ERROR: ${e.message}`);
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     */
    async findChapterPages(chapterId) {
        const url = `${this.api}/${chapterId}`;
        console.log(`[Komiku] findChapterPages: Fetching pages for Chapter ID: ${chapterId} at URL: ${url}`);

        try {
            const response = await fetch(url);
            console.log(`[Komiku] findChapterPages: Response status: ${response.status}`);

            if (!response.ok) {
                console.error(`[Komiku] findChapterPages: Request failed. Status: ${response.status}`);
                return [];
            }
            
            const body = await response.text();
            console.log(`[Komiku] findChapterPages: Received body (length: ${body.length})`);

            const doc = LoadDoc(body);
            if (!doc) {
                console.error("[Komiku] findChapterPages: LoadDoc(body) returned null or undefined.");
                return [];
            }
            console.log("[Komiku] findChapterPages: Document loaded.");

            let pages = [];

            const images = doc('img.klazy.ww');
            console.log(`[Komiku] findChapterPages: Found ${images.length} elements with selector "img.klazy.ww".`);

            images.each((index, element) => {
                const imgUrl = element.attrs()['src'];

                if (imgUrl) {
                    console.log(`[Komiku] findChapterPages: Found page ${index}: ${imgUrl}`);
                    pages.push({
                        url: imgUrl,
                        index: index,
                        // No headers needed
                    });
                } else {
                    console.warn(`[Komiku] findChapterPages: Image at index ${index} missing 'src' attribute.`);
                }
            });

            console.log(`[Komiku] findChapterPages: Successfully parsed ${pages.length} pages.`);
            return pages;
        }
        catch (e) {
            console.error(`[Komiku] findChapterPages: CRITICAL ERROR: ${e.message}`);
            return [];
        }
    }
}

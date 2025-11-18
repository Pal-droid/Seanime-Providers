/**
 * Seanime Extension for Comix
 * Implements MangaProvider interface for 'https://comix.to'.
 */
class Provider {

    constructor() {
        this.api = 'https://comix.to';
        this.apiUrl = 'https://comix.to/api/v2';
    }

    getSettings() {
        return {
            supportsMultiScanlator: true, // API returns scanlator info
        };
    }

    /**
     * Searches for manga based on a query.
     * Uses the API to find manga and constructs a composite ID containing the hash_id and slug.
     */
    async search(opts) {
        const queryParam = opts.query;
        // Assumed search endpoint based on standard V2 API patterns for this site structure
        const url = `${this.apiUrl}/manga?keyword=${encodeURIComponent(queryParam)}&order[relevance]=desc`;

        try {
            const response = await fetch(url);

            if (!response.ok) return [];
            
            const data = await response.json();
            
            // Check if result items exist
            if (!data.result || !data.result.items) return [];

            const items = data.result.items;
            let mangas = [];

            items.forEach((item) => {
                // We need both hash_id and slug for subsequent requests.
                // Storing them as a composite ID: "hash_id|slug"
                const compositeId = `${item.hash_id}|${item.slug}`;

                // Extract image from poster object
                let imageUrl = '';
                if (item.poster) {
                    imageUrl = item.poster.medium || item.poster.large || item.poster.small || '';
                }

                mangas.push({
                    id: compositeId,
                    title: item.title,
                    synonyms: item.alt_titles,
                    year: undefined, 
                    image: imageUrl, 
                });
            });

            return mangas;
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID.
     * Manga ID is expected to be "hash_id|slug".
     */
    async findChapters(mangaId) {
        // Deconstruct the composite ID
        const [hashId, slug] = mangaId.split('|');

        if (!hashId || !slug) return [];

        // Endpoint: https://comix.to/api/v2/manga/{hash_id}/chapters
        const url = `${this.apiUrl}/manga/${hashId}/chapters?order[number]=desc&limit=100`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.result || !data.result.items) return [];

            let chapters = [];

            data.result.items.forEach((item) => {
                // Construct a composite Chapter ID containing all info needed for the page URL
                // Format: "hash_id|slug|chapter_id|number"
                const compositeChapterId = `${hashId}|${slug}|${item.chapter_id}|${item.number}`;

                chapters.push({
                    id: compositeChapterId,
                    url: `${this.api}/title/${hashId}-${slug}/${item.chapter_id}-chapter-${item.number}`, // Web URL representation
                    title: item.name || `Chapter ${item.number}`,
                    chapter: item.number.toString(),
                    index: 0, // Will be set by sorting below
                    scanlator: item.scanlation_group ? item.scanlation_group.name : undefined,
                    language: item.language
                });
            });

            chapters.sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));

            chapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return chapters;
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     * Chapter ID is expected to be "hash_id|slug|chapter_id|number".
     */
    async findChapterPages(chapterId) {
        // Deconstruct the composite ID
        const parts = chapterId.split('|');
        if (parts.length < 4) return [];

        const [hashId, slug, specificChapterId, number] = parts;

        // Construct the web page URL to scrape
        // URL: https://comix.to/title/{hash_id}-{slug}/{chapter_id}-chapter-{number}
        const url = `${this.api}/title/${hashId}-${slug}/${specificChapterId}-chapter-${number}`;

        try {
            const response = await fetch(url);
            const body = await response.text();
            
            // We don't need to parse the full DOM. The images are in a JSON string inside a script.
            // Regex to find "\"images\":[\"url1\", \"url2\"]" pattern
            const regex = /\\"images\\":(\[.*?\])/;
            const match = body.match(regex);

            if (!match || !match[1]) return [];

            // Parse the JSON array string
            // The match[1] will be something like: ["https://...", "https://..."] (escaped in source, but regex capture might need unescaping depending on raw extraction)
            // Since we are matching raw text, we parse the JSON content.
            let imagesData = [];
            try {
                // We need to parse the JSON string. 
                imagesData = JSON.parse(match[1]);
            } catch (jsonError) {
                // Fallback: if parsing fails, the string might contain escaped quotes like [\ "url\" ]. 
                // This simple cleaner handles standard JSON string arrays.
                const cleanString = match[1].replace(/\\"/g, '"');
                imagesData = JSON.parse(cleanString);
            }

            let pages = [];

            imagesData.forEach((imgUrl, index) => {
                pages.push({
                    url: imgUrl,
                    index: index,
                    headers: {
                        'Referer': url,
                    },
                });
            });

            return pages;
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }
}

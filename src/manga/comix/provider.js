/**
 * Seanime Extension for Comick
 * Implements MangaProvider interface for 'https://comick.io'.
 */
class Provider {

    constructor() {
        this.api = 'https://api.comick.io';
    }

    api = ''; 

    getSettings() {
        return {
            supportsMultiLanguage: true, // Comick supports multiple languages
            supportsMultiScanlator: true, // Comick lists scanlators
        };
    }

    /**
     * Searches for manga based on a query.
     * Uses the JSON API structure provided.
     */
    async search(opts) {
        const queryParam = opts.query;
        // Endpoint derived from standard API patterns for this structure
        const url = `${this.api}/v1.0/search?q=${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url);

            if (!response.ok) return [];
            
            const data = await response.json();
            
            // Verify structure matches comix.txt: { result: { items: [...] } } or direct array
            // Common API behavior for this structure:
            const items = data.result?.items || [];
            
            let mangas = [];

            items.forEach((element) => {
                // "what we need is: hash id, and slug."
                const id = element.hash_id; // Using hash_id as the primary ID
                const title = element.title;
                const slug = element.slug;
                
                // The provided text snippet did not contain an image/cover field.
                // Leaving empty to strictly follow provided info.
                const image = ''; 

                if (id && title) {
                    mangas.push({
                        id: id,
                        title: title,
                        synopsis: element.synopsis,
                        year: undefined,
                        image: image, 
                    });
                }
            });

            return mangas;
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID (hash_id).
     */
    async findChapters(mangaId) {
        // Endpoint for fetching chapters using the manga hash_id
        const url = `${this.api}/comic/${mangaId}/chapters?lang=en`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            
            // Structure from comix.txt: { result: { items: [...] } }
            // Note: API might return data directly or wrapped in result.items
            // We check both to be safe given the snippet.
            let items = [];
            if (data.chapters) {
                items = data.chapters;
            } else if (data.result && data.result.items) {
                items = data.result.items;
            } else if (Array.isArray(data)) {
                items = data;
            }

            let chapters = [];

            items.forEach((element) => {
                // "we scrape chapter id and chapter number"
                const id = element.chapter_id; // Check if this is string or int
                const chapterNumber = element.number || element.chap;
                const title = element.title || element.name || `Chapter ${chapterNumber}`;
                const scanlator = element.scanlation_group?.name;

                if (id) {
                    chapters.push({
                        id: String(id), // Ensure ID is string for compatibility
                        url: `${this.api}/chapter/${element.hid || id}`, // Web URL or API specific
                        title: title,
                        chapter: String(chapterNumber),
                        index: 0, // Will sort and assign later
                        scanlator: scanlator
                    });
                }
            });

            // Remove duplicates based on ID
            const uniqueChapters = Array.from(new Set(chapters.map(c => c.id)))
                .map(id => chapters.find(c => c.id === id));

            // Sort by chapter number descending (usually better for manga apps)
            uniqueChapters.sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));

            uniqueChapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return uniqueChapters;
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     */
    async findChapterPages(chapterId) {
        // Endpoint to get chapter images. 
        // Uses the chapter ID (often the 'hid' in real API, but we use chapterId from previous step)
        const url = `${this.api}/chapter/${chapterId}`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            
            // Parsing logic based on standard structure for this provider type
            // usually data.chapter.images which is an array
            const chapterData = data.chapter || data;
            const images = chapterData.images || [];
            
            let pages = [];

            images.forEach((img, index) => {
                // Construct direct URL
                // NOTE: 'no weserv image proxying' requested.
                // Images are typically on 'https://meo.comick.pictures' or similar CDN.
                // The API often provides the 'url' field directly or a filename.
                
                let imgUrl = img.url;
                
                // Fallback if the API only gives a filename (common in this provider)
                if (!imgUrl || !imgUrl.startsWith('http')) {
                     // Default CDN for this provider if not absolute URL
                    imgUrl = `https://meo.comick.pictures/${imgUrl || img.b2key}`;
                }

                pages.push({
                    url: imgUrl,
                    index: index,
                    headers: {
                        // No specific referer usually needed for direct CDN, but good practice
                        'Referer': 'https://comick.io/' 
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

/**
 * Komikcast Extension
 * Implements MangaProvider interface for 'https://komikcast03.com'.
 */
class Provider {

    constructor() {
        // Base URL
        this.api = 'https://komikcast03.com';
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
        // Search URL format: https://komikcast03.com/?s=jujutsu+kaisen
        const queryParam = opts.query;
        const url = `${this.api}/?s=${encodeURIComponent(queryParam)}`;

        try {
            const response = await fetch(url);

            if (!response.ok) return [];

            const body = await response.text();
            const doc = LoadDoc(body);

            let mangas = [];

            const items = doc('div.list-update_item');

            items.each((index, element) => {
                const anchorElement = element.find('a').first();
                const titleElement = element.find('h3.title').first();
                const imageElement = element.find('img').first();

                const title = titleElement.text().trim();
                const mangaUrl = anchorElement.attrs()['href'];

                // Extract manga ID from the URL: https://komikcast03.com/komik/jujutsu-kaisen-modulo/
                // ID will be 'jujutsu-kaisen-modulo'
                const mangaIdMatch = mangaUrl.match(/\/komik\/([^\/]+)\/?$/);
                const mangaId = mangaIdMatch ? mangaIdMatch[1] : null;

                const imageUrl = imageElement.attrs()['src']; 

                if (mangaId && title && imageUrl) {
                    mangas.push({
                        id: mangaId,
                        title: title,
                        synonyms: undefined,
                        year: undefined,
                        image: imageUrl,
                    });
                }
            });

            return mangas;
        }
        catch (e) {
            console.error("Komikcast search failed:", e);
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID.
     */
    async findChapters(mangaId) {
        // Manga URL format: https://komikcast03.com/komik/jujutsu-kaisen-modulo/
        const url = `${this.api}/komik/${mangaId}/`;

        try {
            const response = await fetch(url);
            const body = await response.text();
            const doc = LoadDoc(body);

            let chapters = [];
            let chapterIndex = 0; // Use an index for sorting later

            doc('li.komik_info-chapters-item').each((index, element) => {
                const linkElement = element.find('a.chapter-link-item').first();
                if (!linkElement || !linkElement.attrs || !linkElement.attrs()['href']) {
                    return;
                }

                const fullUrl = linkElement.attrs()['href'];
                const titleText = linkElement.text().trim();

                // Extract chapter ID from the URL: 
                // https://komikcast03.com/chapter/jujutsu-kaisen-modulo-chapter-10-bahasa-indonesia/
                // ID will be 'chapter/jujutsu-kaisen-modulo-chapter-10-bahasa-indonesia'
                const chapterIdMatch = fullUrl.match(/\/chapter\/(.+)\/?$/);
                const chapterId = chapterIdMatch ? `chapter/${chapterIdMatch[1]}` : null;
                
                // Title text is typically "Chapter 10" - we need to extract the number
                let chapterNumber = '0';
                const chapMatch = titleText.match(/(\d+(\.\d+)?)/);
                if (chapMatch) chapterNumber = chapMatch[0];

                if (chapterId) {
                    chapters.push({
                        id: chapterId,
                        url: fullUrl,
                        title: titleText,
                        chapter: chapterNumber,
                        index: chapterIndex++,
                    });
                }
            });

            // Komikcast usually lists chapters from newest to oldest. 
            // Sort them to be oldest (lowest number) first, then assign index based on that sort.
            chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

            // Re-assign index based on the sorted order
            chapters.forEach((chapter, i) => {
                chapter.index = i;
            });

            return chapters;
        }
        catch (e) {
            console.error("Komikcast findChapters failed:", e);
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     */
    async findChapterPages(chapterId) {
        // Chapter URL format: https://komikcast03.com/chapter/jujutsu-kaisen-modulo-chapter-10-bahasa-indonesia/
        // chapterId is like 'chapter/jujutsu-kaisen-modulo-chapter-10-bahasa-indonesia'
        const url = `${this.api}/${chapterId}/`;
        const referer = url; // Set referer to the chapter page URL

        try {
            const response = await fetch(url);
            const body = await response.text();
            const doc = LoadDoc(body);

            let pages = [];
            let pageIndex = 0;

            doc('div.main-reading-area img').each((index, element) => {
                const imgUrl = element.attrs()['src']; 

                if (imgUrl) {
                    pages.push({
                        url: imgUrl,
                        index: pageIndex++,
                        headers: {
                            'Referer': referer, 
                        },
                    });
                }
            });

            return pages;
        }
        catch (e) {
            console.error("Komikcast findChapterPages failed:", e);
            return [];
        }
    }
}

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
            supportsMultiScanlator: true,
        };
    }

    /**
     * Searches for manga.
     */
    async search(opts) {
        const queryParam = opts.query;
        const url = `${this.apiUrl}/manga?keyword=${encodeURIComponent(queryParam)}&order[relevance]=desc`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            
            const data = await response.json();
            if (!data.result || !data.result.items) return [];

            const items = data.result.items;
            let mangas = [];

            items.forEach((item) => {
                const compositeId = `${item.hash_id}|${item.slug}`;

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
     * Finds all chapters.
     */
    async findChapters(mangaId) {
        const [hashId, slug] = mangaId.split('|');
        if (!hashId || !slug) return [];

        const url = `${this.apiUrl}/manga/${hashId}/chapters?order[number]=desc&limit=100`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.result || !data.result.items) return [];

            let chapters = [];

            data.result.items.forEach((item) => {
                const compositeChapterId = `${hashId}|${slug}|${item.chapter_id}|${item.number}`;

                chapters.push({
                    id: compositeChapterId,
                    url: `${this.api}/title/${hashId}-${slug}/${item.chapter_id}-chapter-${item.number}`,
                    title: item.name || `Chapter ${item.number}`,
                    chapter: item.number.toString(),
                    index: 0,

                    scanlator: (() => {
                        if (item.is_official === 1) return "Official";
                        const name = item.scanlation_group?.name?.trim();
                        return name && name.length > 0 ? name : undefined;
                    })(),

                    language: item.language
                });
            });

            chapters.sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter));
            chapters.forEach((chapter, i) => (chapter.index = i));

            return chapters;
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }

    /**
     * Finds all image pages.
     */
    async findChapterPages(chapterId) {
        const parts = chapterId.split('|');
        if (parts.length < 4) return [];

        const [hashId, slug, specificChapterId, number] = parts;
        const url = `${this.api}/title/${hashId}-${slug}/${specificChapterId}-chapter-${number}`;

        try {
            const response = await fetch(url);
            const body = await response.text();

            // Matches: "images":[...], \"images\": [...], ,"images":[...], etc.
            const regex = /["\\]*images["\\]*\s*:\s*(\[[^\]]*\])/s;

            const match = body.match(regex);
            if (!match || !match[1]) {
                console.error("Images regex NOT matched");
                return [];
            }

            let images = [];

            try {
                images = JSON.parse(match[1]);
            } catch {
                const clean = match[1].replace(/\\"/g, '"');
                images = JSON.parse(clean);
            }

            return images.map((img, index) => ({
                url: img.url,
                index,
                headers: {
                    Referer: url,
                },
            }));
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }
}
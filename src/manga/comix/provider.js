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
     * Finds all chapters 
     */
    async findChapters(mangaId) {
        const [hashId, slug] = mangaId.split('|');
        if (!hashId || !slug) return [];

        const baseUrl = `${this.apiUrl}/manga/${hashId}/chapters?order[number]=desc&limit=100`;

        try {
            // First page request
            const firstRes = await fetch(baseUrl);
            const firstData = await firstRes.json();

            if (!firstData.result || !firstData.result.items) return [];

            const totalPages = firstData.result.pagination?.last_page || 1;

            let allChapters = [...firstData.result.items];

            // Fetch remaining pages
            for (let page = 2; page <= totalPages; page++) {
                const pageUrl = `${baseUrl}&page=${page}`;
                const res = await fetch(pageUrl);
                const data = await res.json();

                if (data.result?.items?.length > 0) {
                    allChapters.push(...data.result.items);
                }
            }

            // Map chapters with proper title & scanlator
            let chapters = allChapters.map((item) => {
                const compositeChapterId = `${hashId}|${slug}|${item.chapter_id}|${item.number}`;

                // Chapter title rules
                const chapterTitle = item.name && item.name.trim().length > 0
                    ? `Chapter ${item.number} — ${item.name}`
                    : `Chapter ${item.number}`;

                return {
                    id: compositeChapterId,
                    url: `${this.api}/title/${hashId}-${slug}/${item.chapter_id}-chapter-${item.number}`,
                    title: chapterTitle,
                    chapter: item.number.toString(),
                    index: 0,
                    scanlator:
                        item.is_official === 1
                            ? "Official"
                            : (item.scanlation_group?.name?.trim() || undefined),
                    language: item.language
                };
            });

            // Sort descending by chapter number
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
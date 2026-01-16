/**
 * Seanime Extension for Comix
 * Implements MangaProvider interface for 'https://comix.to'.
 */
class Provider {

    constructor() {
        this.apiUrl = 'https://comix.to/api/v2';
    }

    getSettings() {
        return {
            supportsMultiScanlator: false,
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
                    url: `https://comix.to/title/${hashId}-${slug}/${item.chapter_id}-chapter-${item.number}`,
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

            // Always apply deduplication
            chapters = this.deduplicateChapters(chapters);

            // Sort ascending by chapter number (Reversed list)
            chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
            chapters.forEach((chapter, i) => (chapter.index = i));

            return chapters;
        }
        catch (e) {
            return [];
        }
    }

    /**
     * Extract numeric chapter number from chapter string
     */
    extractChapterNumber(chapterStr) {
        // Try to parse as float first
        const num = parseFloat(chapterStr);
        if (!isNaN(num)) {
            return num;
        }
        
        // If that fails, try to extract numbers from the string
        const match = chapterStr.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    }

    /**
     * Deduplicate chapters by chapter number only
     * When multiple scanlators have the same chapter number, keep the best version
     */
    deduplicateChapters(chapters) {
        const chapterMap = new Map();
        
        // Process chapters to find the best version of each chapter
        chapters.forEach(chapter => {
            const chapterNum = this.extractChapterNumber(chapter.chapter);
            const chapterNumKey = chapterNum.toString(); // Use string as key for consistency
            
            if (!chapterMap.has(chapterNumKey)) {
                // First time seeing this chapter number
                chapterMap.set(chapterNumKey, { ...chapter });
            } else {
                // We already have a chapter with this number
                const existing = chapterMap.get(chapterNumKey);
                
                // Check which title is more complete (has "—" separator with extra content)
                const existingHasTitle = existing.title.includes("—");
                const currentHasTitle = chapter.title.includes("—");
                
                // Combine scanlator names if they're different
                let combinedScanlator = existing.scanlator;
                if (chapter.scanlator && existing.scanlator) {
                    const existingScanlators = existing.scanlator.split(', ');
                    if (!existingScanlators.includes(chapter.scanlator)) {
                        combinedScanlator = `${existing.scanlator}, ${chapter.scanlator}`;
                    }
                } else if (chapter.scanlator && !existing.scanlator) {
                    combinedScanlator = chapter.scanlator;
                }
                
                // Decide which chapter to keep
                if (currentHasTitle && !existingHasTitle) {
                    // Current chapter has a title, existing doesn't - replace with current
                    chapterMap.set(chapterNumKey, { 
                        ...chapter, 
                        scanlator: combinedScanlator 
                    });
                } else {
                    // Keep existing but update scanlator info
                    existing.scanlator = combinedScanlator;
                }
            }
        });
        
        // Convert map back to array
        return Array.from(chapterMap.values());
    }

    /**
     * Finds all image pages.
     */
    async findChapterPages(chapterId) {
        const parts = chapterId.split('|');
        if (parts.length < 4) return [];

        const [hashId, slug, specificChapterId, number] = parts;
        const url = `https://comix.to/title/${hashId}-${slug}/${specificChapterId}-chapter-${number}`;

        try {
            const response = await fetch(url);
            const body = await response.text();

            // Matches: "images":[...], \"images\": [...], ,"images":[...], etc.
            const regex = /["\\]*images["\\]*\s*:\s*(\[[^\]]*\])/s;

            const match = body.match(regex);
            if (!match || !match[1]) {
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
            return [];
        }
    }
}

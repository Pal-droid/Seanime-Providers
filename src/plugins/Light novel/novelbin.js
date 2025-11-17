(function() {
    // Check if script is already loaded
    if (window.NovelBinSource) {
        return;
    }

    const CORS_PROXY_URL = "https://corsproxy.io/?url=";
    const NOVELBIN_URL = "https://novelbin.me";

    // --- Private Utility Functions ---

    function getLevenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function getSimilarity(s1, s2) {
        let longer = s1.toLowerCase();
        let shorter = s2.toLowerCase();
        if (s1.length < s2.length) { longer = s2.toLowerCase(); shorter = s1.toLowerCase(); }
        let longerLength = longer.length;
        if (longerLength == 0) { return 1.0; }
        const distance = getLevenshteinDistance(longer, shorter);
        return (longerLength - distance) / parseFloat(longerLength);
    }

    // --- Interface Implementation ---

    /**
     * Searches NovelBin for a query
     * @param {string} query 
     * @returns {Promise<SearchResult[]>}
     */
    async function manualSearch(query) {
        const url = `${CORS_PROXY_URL}${NOVELBIN_URL}/search?keyword=${encodeURIComponent(query)}`;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const results = [];
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const items = doc.querySelectorAll('.list-novel .row'); 
            
            items.forEach(item => {
                const titleElement = item.querySelector('h3.novel-title a');
                const title = titleElement?.title?.trim() || "Unknown Title";
                let novelUrl = titleElement?.getAttribute('href') || "#";
                
                if (novelUrl.startsWith("/")) {
                    novelUrl = `${NOVELBIN_URL}${novelUrl}`;
                }

                let image = item.querySelector('img.cover')?.getAttribute('src') || "";
                if (image.startsWith("//")) { 
                    image = `https:${image}`; 
                } else if (image.startsWith("/")) {
                    image = `${NOVELBIN_URL}${image}`;
                }

                // --- FIX: Use correct selector based on novelbin.txt ---
                const latestChapterElement = item.querySelector('span.chr-text.chapter-title');
                const latestChapter = latestChapterElement?.textContent?.trim() || "No Chapter";
                // --- END FIX ---
              
                results.push({ 
                    title: title, 
                    url: novelUrl, 
                    image: image, 
                    latestChapter: latestChapter 
                });
            });
            return results;
        } catch (err) {
            console.error("[novel-plugin] NovelBin Search Error:", err);
            return [];
        }
    }

    /**
     * Gets all chapter URLs and titles for a novel
     * @param {string} novelUrl 
     * @returns {Promise<Chapter[]>}
     */
    async function getChapters(novelUrl) {
        try {
            // --- FIX: Extract novel slug from URL. This is the correct ID. ---
            const novelSlugMatch = novelUrl.match(/novel-book\/(.*?)(?:\/|$)/);
            if (!novelSlugMatch || !novelSlugMatch[1]) {
                 throw new Error(`Could not extract novel-slug from URL: ${novelUrl}`);
            }
            const novelSlug = novelSlugMatch[1];
            // --- END FIX ---

            const chapters = [];
            const parser = new DOMParser();

            // --- UPDATED: Use the correct chapter API endpoint ---
            const chapterApiUrl = `${CORS_PROXY_URL}${NOVELBIN_URL}/ajax/chapter-archive?novelId=${novelSlug}`;
            const chapterRes = await fetch(chapterApiUrl);
            const chapterHtml = await chapterRes.text();
            const chapterDoc = parser.parseFromString(chapterHtml, "text/html");

            const chapterItems = chapterDoc.querySelectorAll('ul.list-chapter li a');
            chapterItems.forEach(link => {
                let url = link.getAttribute('href');
                if (url && url.startsWith("/")) {
                    url = `${NOVELBIN_URL}${url}`;
                }
                
                let title = link.getAttribute('title')?.trim() || "Unknown Chapter";
                
                if (url) {
                    chapters.push({ url: url, title: title });
                }
            });
            
            return chapters;
        } catch (err) {
            console.error("[novel-plugin] NovelBin Details Error:", err);
            return [];
        }
    }

    /**
     * Gets the processed HTML content for a single chapter
     * @param {string} chapterUrl 
     * @returns {Promise<string>}
     */
    async function getChapterContent(chapterUrl) {
        try {
            const res = await fetch(`${CORS_PROXY_URL}${chapterUrl}`);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const contentElement = doc.querySelector('#novel-chapter-content');
    
            if (!contentElement) {
                throw new Error("Could not extract chapter content.");
            }
    
            contentElement.querySelectorAll('script, div[id^="pf-"], ins, .ads, .ads-middle').forEach(el => el.remove());
    
            return contentElement.innerHTML;
        } catch (err) {
            console.error("[novel-plugin] NovelBin ChapterContent Error:", err);
            return "<p>Error loading chapter content.</p>";
        }
    }

    /**
     * Tries to find the best match on NovelBin for an Anilist title
     * @param {string} romajiTitle 
     * @param {string} englishTitle 
     * @returns {Promise<{ match: SearchResult, similarity: number } | null>}
     */
    async function autoMatch(romajiTitle, englishTitle) {
        console.log(`[novel-plugin-matcher] (NovelBin) START: Matching for "${romajiTitle}"`);
        
        // 1. Get results for Romaji title
        const romajiResults = await manualSearch(romajiTitle);
        let bestRomajiMatch = null;
        let bestRomajiScore = 0.0;
        if (romajiResults && romajiResults.length > 0) {
            romajiResults.forEach(item => {
                const similarity = getSimilarity(romajiTitle, item.title);
                console.log(`[novel-plugin-matcher] (NovelBin) Romaji Compare: "${romajiTitle}" vs "${item.title}" (Score: ${similarity.toFixed(2)})`);
                if (similarity > bestRomajiScore) {
                    bestRomajiScore = similarity;
                    bestRomajiMatch = item;
                }
            });
        }
        console.log(`[novel-plugin-matcher] (NovelBin) Romaji Best: "${bestRomajiMatch?.title}" (Score: ${bestRomajiScore.toFixed(2)})`);

        // 2. Get results for English title
        let bestEnglishMatch = null;
        let bestEnglishScore = 0.0;
        if (englishTitle && englishTitle.toLowerCase() !== romajiTitle.toLowerCase()) {
            console.log(`[novel-plugin-matcher] (NovelBin) INFO: Also matching with English: "${englishTitle}"`);
            const englishResults = await manualSearch(englishTitle);
            if (englishResults && englishResults.length > 0) {
                englishResults.forEach(item => {
                    const similarity = getSimilarity(englishTitle, item.title);
                    console.log(`[novel-plugin-matcher] (NovelBin) English Compare: "${englishTitle}" vs "${item.title}" (Score: ${similarity.toFixed(2)})`);
                    if (similarity > bestEnglishScore) {
                        bestEnglishScore = similarity;
                        bestEnglishMatch = item;
                    }
                });
            }
            console.log(`[novel-plugin-matcher] (NovelBin) English Best: "${bestEnglishMatch?.title}" (Score: ${bestEnglishScore.toFixed(2)})`);
        }

        // 3. Compare the best scores
        let bestMatch = null;
        let highestSimilarity = 0.0;
        if (bestRomajiScore > bestEnglishScore) {
            bestMatch = bestRomajiMatch;
            highestSimilarity = bestRomajiScore;
        } else {
            bestMatch = bestEnglishMatch;
            highestSimilarity = bestEnglishScore;
        }

        console.log(`[novel-plugin-matcher] (NovelBin) Final Best: "${bestMatch?.title}" (Score: ${highestSimilarity.toFixed(2)})`);

        // 4. Check against the 0.8 threshold
        if (highestSimilarity > 0.8 && bestMatch) {
            console.log(`[novel-plugin-matcher] (NovelBin) SUCCESS: Match found (Score > 0.8).`);
            return {
                match: bestMatch,
                similarity: highestSimilarity
            };
        } else {
            console.log(`[novel-plugin-matcher] (NovelBin) FAILURE: No match found above 0.8 threshold.`);
            return null;
        }
    }

    // --- Create and Register The Source ---

    const novelBinSource = {
        id: "novelbin",
        name: "NovelBin",
        autoMatch,
        manualSearch,
        getChapters,
        getChapterContent
    };

    if (window.novelPluginRegistry) {
        window.novelPluginRegistry.registerSource(novelBinSource);
        console.log('[novel-plugin] NovelBinSource registered.');
    } else {
        console.error('[novel-plugin] NovelBinSource: Registry not found!');
    }

})();

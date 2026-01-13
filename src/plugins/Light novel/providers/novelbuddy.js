(function() {
    // Check if script is already loaded
    if (window.NovelBuddySource) {
        return;
    }

    const NOVELBUDDY_URL = "https://corsproxy.io/?url=https://novelbuddy.com";

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
     * Searches NovelBuddy for a query
     */
    async function manualSearch(query) {
        const url = `${NOVELBUDDY_URL}/search?q=${encodeURIComponent(query)}`;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const results = [];
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const items = doc.querySelectorAll('.book-item');
            
            items.forEach(item => {
                const titleElement = item.querySelector('h3 a');
                const title = titleElement?.title?.trim() || "Unknown Title";
                const novelUrl = titleElement?.getAttribute('href') || "#";
                let image = item.querySelector('.thumb img.lazy')?.getAttribute('data-src') || "";
                if (image.startsWith("//")) { 
                    image = `https:${image}`; 
                } else if (image.startsWith("/")) {
                    image = `${NOVELBUDDY_URL}${image}`;
                }
                const latestChapter = item.querySelector('.latest-chapter')?.textContent?.trim() || "No Chapter";
              
                results.push({ 
                    title: title, 
                    url: novelUrl, 
                    image: image, 
                    latestChapter: latestChapter 
                });
            });
            return results;
        } catch (err) {
            console.error("[novel-plugin] NovelBuddy Search Error:", err);
            return [];
        }
    }

    /**
     * Gets all chapter URLs and titles for a novel
     */
    async function getChapters(novelUrl) {
        const url = `${NOVELBUDDY_URL}${novelUrl}`;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const bookIdMatch = html.match(/var bookId = (\d+);/);
            if (!bookIdMatch || !bookIdMatch[1]) {
                throw new Error("Could not find bookId on novel page.");
            }
            const bookId = bookIdMatch[1];
            const chapterApiUrl = `${NOVELBUDDY_URL}/api/manga/${bookId}/chapters?source=detail`;
            const chapterRes = await fetch(chapterApiUrl);
            const chapterHtml = await chapterRes.text();
            const chapters = [];
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(chapterHtml, "text/html");
            const chapterItems = doc.querySelectorAll('ul.chapter-list li a');
            chapterItems.forEach(link => {
                const url = link.getAttribute('href');
                let title = link.querySelector('strong.chapter-title')?.textContent?.trim();
                if (!title || title.length === 0) {
                    title = link.getAttribute('title')?.trim() || "Unknown Chapter";
                }
                if (url) {
                    chapters.push({ url: url, title: title });
                }
            });
            return chapters.reverse();
        } catch (err) {
            console.error("[novel-plugin] NovelBuddy Details Error:", err);
            return [];
        }
    }

    /**
     * Gets the processed HTML content for a single chapter
     * Specifically cleans watermarks and garbage elements
     */
    async function getChapterContent(chapterUrl) {
        const url = `${NOVELBUDDY_URL}${chapterUrl}`;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const contentElement = doc.querySelector('.content-inner');
    
            if (!contentElement) {
                throw new Error("Could not extract chapter content.");
            }

            // 1. Remove specific known ad/garbage elements
            contentElement.querySelectorAll('script, div[id^="pf-"], div[style*="text-align:center"], ins, div[align="center"], .code-block, .ads-container').forEach(el => el.remove());
    
            // 2. Extract HTML as string to handle Unicode text watermarks
            let cleanHtml = contentElement.innerHTML;

            // Target the specific unicode string: "f𝘳𝚎𝐞we𝐛𝑛𝐨𝘃e𝘭.co𝘮"
            // And common variations
            const watermarks = [
                /f𝘳𝚎𝐞we𝐛𝑛𝐨𝘃e𝘭\.co𝘮/g,
                /freewebnovel\.com/gi,
                /𝘧𝘳𝘦𝘦𝘸𝘦𝘣𝘯𝘰𝘷𝘦𝘭/gi
            ];

            watermarks.forEach(pattern => {
                cleanHtml = cleanHtml.replace(pattern, "");
            });

            // 3. Final DOM cleanup (remove empty tags left by the replacement)
            const wrapper = document.createElement('div');
            wrapper.innerHTML = cleanHtml;

            wrapper.querySelectorAll('p, div, span').forEach(el => {
                // Remove elements that are empty or only contain whitespace/line breaks
                if (!el.textContent.trim() && el.children.length === 0) {
                    el.remove();
                }
            });

            return wrapper.innerHTML;
        } catch (err) {
            console.error("[novel-plugin] NovelBuddy ChapterContent Error:", err);
            return "<p>Error loading chapter content.</p>";
        }
    }

    /**
     * Tries to find the best match on NovelBuddy for an Anilist title
     */
    async function autoMatch(romajiTitle, englishTitle) {
        console.log(`[novel-plugin-matcher] (NovelBuddy) START: Matching for "${romajiTitle}"`);
        
        const romajiResults = await manualSearch(romajiTitle);
        let bestRomajiMatch = null;
        let bestRomajiScore = 0.0;
        if (romajiResults && romajiResults.length > 0) {
            romajiResults.forEach(item => {
                const similarity = getSimilarity(romajiTitle, item.title);
                if (similarity > bestRomajiScore) {
                    bestRomajiScore = similarity;
                    bestRomajiMatch = item;
                }
            });
        }

        let bestEnglishMatch = null;
        let bestEnglishScore = 0.0;
        if (englishTitle && englishTitle.toLowerCase() !== romajiTitle.toLowerCase()) {
            const englishResults = await manualSearch(englishTitle);
            if (englishResults && englishResults.length > 0) {
                englishResults.forEach(item => {
                    const similarity = getSimilarity(englishTitle, item.title);
                    if (similarity > bestEnglishScore) {
                        bestEnglishScore = similarity;
                        bestEnglishMatch = item;
                    }
                });
            }
        }

        let bestMatch = null;
        let highestSimilarity = 0.0;
        if (bestRomajiScore > bestEnglishScore) {
            bestMatch = bestRomajiMatch;
            highestSimilarity = bestRomajiScore;
        } else {
            bestMatch = bestEnglishMatch;
            highestSimilarity = bestEnglishScore;
        }

        if (highestSimilarity > 0.8 && bestMatch) {
            return { match: bestMatch, similarity: highestSimilarity };
        } else {
            return null;
        }
    }

    const novelBuddySource = {
        id: "novelbuddy",
        name: "NovelBuddy",
        autoMatch,
        manualSearch,
        getChapters,
        getChapterContent
    };

    if (window.novelPluginRegistry) {
        window.novelPluginRegistry.registerSource(novelBuddySource);
        console.log('[novel-plugin] NovelBuddySource registered with content cleaning.');
    } else {
        console.error('[novel-plugin] NovelBuddySource: Registry not found!');
    }

})();

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
              
                results.push({ title, url: novelUrl, image, latestChapter });
            });
            return results;
        } catch (err) {
            console.error("[novel-plugin] NovelBuddy Search Error:", err);
            return [];
        }
    }

    async function getChapters(novelUrl) {
        const url = `${NOVELBUDDY_URL}${novelUrl}`;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const bookIdMatch = html.match(/var bookId = (\d+);/);
            if (!bookIdMatch || !bookIdMatch[1]) throw new Error("Could not find bookId.");
            
            const bookId = bookIdMatch[1];
            const chapterApiUrl = `${NOVELBUDDY_URL}/api/manga/${bookId}/chapters?source=detail`;
            const chapterRes = await fetch(chapterApiUrl);
            const chapterHtml = await chapterRes.text();
            const chapters = [];
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(chapterHtml, "text/html");
            doc.querySelectorAll('ul.chapter-list li a').forEach(link => {
                const url = link.getAttribute('href');
                let title = link.querySelector('strong.chapter-title')?.textContent?.trim() || link.getAttribute('title')?.trim() || "Unknown Chapter";
                if (url) chapters.push({ url, title });
            });
            return chapters.reverse();
        } catch (err) {
            console.error("[novel-plugin] NovelBuddy Details Error:", err);
            return [];
        }
    }

    /**
     * Gets the processed HTML content for a single chapter
     * Handles obfuscated watermarks via Unicode Normalization
     */
    async function getChapterContent(chapterUrl) {
        const url = `${NOVELBUDDY_URL}${chapterUrl}`;

        // Helper: Converts fancy unicode (𝒻, 𝐚, 𝙚) into plain text (f, a, e)
        const normalizeText = (str) => {
            return str.normalize("NFKD")
                      .replace(/[\u0300-\u036f]/g, "") // Remove accents
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, "");    // Remove symbols/spaces for strict checking
        };

        try {
            const res = await fetch(url);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const contentElement = doc.querySelector('.content-inner');
    
            if (!contentElement) throw new Error("Could not extract content.");

            // 1. Remove obvious ad/script elements
            contentElement.querySelectorAll('script, div[id^="pf-"], ins, .code-block, .ads-container, .hidden').forEach(el => el.remove());
    
            // 2. Scan and remove elements containing the watermark
            const paragraphs = contentElement.querySelectorAll('p, div, span, em, strong');
            paragraphs.forEach(p => {
                const normalized = normalizeText(p.textContent);
                
                // Targets "freewebnovel" in any font style or spacing
                if (normalized.includes("freewebnovel") || 
                    normalized.includes("f r e e") || 
                    normalized.includes("f.r.e.e") ||
                    normalized.includes("freewebn0vel")) {
                    p.remove();
                }
            });

            // 3. Final regex pass on the remaining HTML string for inline fragments
            let cleanHtml = contentElement.innerHTML;
            const fuzzyRegex = /f[^\w]?r[^\w]?e[^\w]?e[^\w]?w[^\w]?e[^\w]?b[^\w]?n[^\w]?o[^\w]?v[^\w]?e[^\w]?l/gi;
            cleanHtml = cleanHtml.replace(fuzzyRegex, "");

            // 4. Clean up empty tags left over
            const wrapper = document.createElement('div');
            wrapper.innerHTML = cleanHtml;
            wrapper.querySelectorAll('p, div').forEach(el => {
                if (!el.textContent.trim() && el.children.length === 0) el.remove();
            });

            return wrapper.innerHTML;
        } catch (err) {
            console.error("[novel-plugin] NovelBuddy Content Error:", err);
            return "<p>Error loading chapter content.</p>";
        }
    }

    async function autoMatch(romajiTitle, englishTitle) {
        const romajiResults = await manualSearch(romajiTitle);
        let bestMatch = null;
        let highestScore = 0.0;

        const processResults = (results, target) => {
            results.forEach(item => {
                const score = getSimilarity(target, item.title);
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = item;
                }
            });
        };

        if (romajiResults) processResults(romajiResults, romajiTitle);
        
        if (englishTitle && englishTitle.toLowerCase() !== romajiTitle.toLowerCase()) {
            const englishResults = await manualSearch(englishTitle);
            if (englishResults) processResults(englishResults, englishTitle);
        }

        return (highestScore > 0.8 && bestMatch) ? { match: bestMatch, similarity: highestScore } : null;
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
    }
})();

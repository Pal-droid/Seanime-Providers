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
            
            // Try multiple selectors to find content
            let contentElement = doc.querySelector('.content-inner') || 
                                doc.querySelector('#chapter__content') ||
                                doc.querySelector('.chapter__content');
            
            if (!contentElement) {
                // Last resort: look for divs that contain chapter content
                const possibleContainers = doc.querySelectorAll('div[class*="content"], div[class*="chapter"], div[id*="content"], div[id*="chapter"]');
                for (const container of possibleContainers) {
                    if (container.textContent.length > 500) { // Reasonable minimum for chapter content
                        contentElement = container;
                        break;
                    }
                }
            }
            
            if (!contentElement) throw new Error("Could not extract content.");

            // 1. Remove obvious ad/script elements
            contentElement.querySelectorAll('script, div[id^="pf-"], ins, .code-block, .ads-container, .hidden, #listen-chapter, #voices, #click-required-button').forEach(el => el.remove());
    
            // 2. Extract all text nodes and rebuild content
            const textNodes = [];
            const walker = document.createTreeWalker(
                contentElement,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                if (node.parentElement.tagName !== 'SCRIPT' && 
                    node.parentElement.tagName !== 'STYLE' &&
                    !node.parentElement.closest('script') &&
                    !node.parentElement.closest('style')) {
                    textNodes.push({
                        text: node.textContent,
                        parent: node.parentElement
                    });
                }
            }
            
            // 3. Filter out watermark text and rebuild clean HTML
            const cleanParagraphs = [];
            let currentParagraph = [];
            
            for (const { text, parent } of textNodes) {
                const normalized = normalizeText(text);
                const isWatermark = normalized.includes("freewebnovel") || 
                                   normalized.includes("freenovel") ||
                                   normalized.includes("novelbuddy") ||
                                   normalized.includes("readnovel") ||
                                   normalized.includes("novel") && normalized.includes("free") ||
                                   text.includes("freewebnove") ||
                                   text.toLowerCase().includes("this content is taken from");
                
                if (!isWatermark && text.trim().length > 0) {
                    currentParagraph.push(text.trim());
                }
                
                // If we hit a line break or the parent is a paragraph/div, finalize the paragraph
                if (text.includes('\n') || parent.tagName === 'P' || parent.tagName === 'DIV' || parent.tagName === 'BR') {
                    if (currentParagraph.length > 0) {
                        const paragraphText = currentParagraph.join(' ').trim();
                        if (paragraphText.length > 10) { // Minimum reasonable paragraph length
                            cleanParagraphs.push(`<p>${paragraphText}</p>`);
                        }
                        currentParagraph = [];
                    }
                }
            }
            
            // Add any remaining text
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join(' ').trim();
                if (paragraphText.length > 10) {
                    cleanParagraphs.push(`<p>${paragraphText}</p>`);
                }
            }
            
            // 4. If we have clean paragraphs, use them
            if (cleanParagraphs.length > 0) {
                return cleanParagraphs.join('');
            }
            
            // 5. Fallback: original cleaning method
            contentElement.querySelectorAll('p, div, span, em, strong').forEach(p => {
                const normalized = normalizeText(p.textContent);
                
                // Targets "freewebnovel" in any font style or spacing
                if (normalized.includes("freewebnovel") || 
                    normalized.includes("freenovel") ||
                    normalized.includes("novelbuddy") ||
                    normalized.includes("readnovel") ||
                    text.includes("freewebnove") ||
                    p.textContent.toLowerCase().includes("this content is taken from")) {
                    p.remove();
                }
            });

            // 6. Final regex pass on the remaining HTML string for inline fragments
            let cleanHtml = contentElement.innerHTML;
            const fuzzyRegex = /f[^\w]?r[^\w]?e[^\w]?e[^\w]?w[^\w]?e[^\w]?b[^\w]?n[^\w]?o[^\w]?v[^\w]?e[^\w]?l|freewebnove|novelbuddy|readnovel/gi;
            cleanHtml = cleanHtml.replace(fuzzyRegex, "");

            // 7. Clean up empty tags left over
            const wrapper = document.createElement('div');
            wrapper.innerHTML = cleanHtml;
            wrapper.querySelectorAll('p, div, span').forEach(el => {
                if (!el.textContent.trim() && el.children.length === 0) el.remove();
            });

            // 8. If content is still too short, try to get text content directly
            if (wrapper.textContent.trim().length < 500) {
                const directText = contentElement.textContent || contentElement.innerText || "";
                if (directText.length > 500) {
                    // Split by double newlines or common paragraph separators
                    const paragraphs = directText.split(/\n\s*\n|\.\s{2,}/).filter(p => {
                        const normalized = normalizeText(p);
                        return !normalized.includes("freewebnovel") && 
                               !normalized.includes("freenovel") &&
                               p.trim().length > 20;
                    });
                    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
                }
            }

            return wrapper.innerHTML || "<p>Error: No content could be extracted.</p>";
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

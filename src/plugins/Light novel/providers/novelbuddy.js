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

        // Improved normalization function for watermark detection
        const normalizeForWatermark = (str) => {
            return str
                .normalize("NFKD") // Decompose fancy Unicode characters
                .replace(/[\u0300-\u036f\u1AB0-\u1AFF\u1DC0-\u1DFF]/g, "") // Remove diacritics
                .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
                .toLowerCase()
                .replace(/\s+/g, "") // Remove all whitespace
                .replace(/[^a-z0-9]/g, ""); // Remove symbols
        };

        // Check if text contains watermark
        const containsWatermark = (text) => {
            const normalized = normalizeForWatermark(text);
            // Common watermark patterns (normalized)
            const watermarkPatterns = [
                'freewebnovel',
                'novelbuddy', 
                'readnovel',
                'freenovel',
                'thiscontentistakenfrom',
                'contentistakenfrom'
            ];
            
            return watermarkPatterns.some(pattern => normalized.includes(pattern));
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
            contentElement.querySelectorAll('script, div[id^="pf-"], ins, .code-block, .ads-container, .hidden, #listen-chapter, #voices, #click-required-button, iframe, .ad, .ads, .advertisement').forEach(el => el.remove());
    
            // 2. Extract all text nodes and rebuild clean content
            const cleanParagraphs = [];
            const walker = document.createTreeWalker(
                contentElement,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let currentNode = walker.nextNode();
            let currentParagraph = [];
            
            while (currentNode) {
                const text = currentNode.textContent.trim();
                const parent = currentNode.parentElement;
                
                // Skip script/style content
                if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || 
                    parent.closest('script') || parent.closest('style')) {
                    currentNode = walker.nextNode();
                    continue;
                }
                
                // Check for watermark in this text node
                if (!containsWatermark(text) && text.length > 0) {
                    currentParagraph.push(text);
                }
                
                // Check if we should finalize the current paragraph
                const shouldBreak = 
                    parent.tagName === 'P' || 
                    parent.tagName === 'DIV' || 
                    parent.tagName === 'BR' ||
                    (currentNode.nextSibling && currentNode.nextSibling.nodeType === 1 && 
                     ['P', 'DIV', 'BR', 'HR'].includes(currentNode.nextSibling.tagName));
                
                if (shouldBreak && currentParagraph.length > 0) {
                    const paragraphText = currentParagraph.join(' ').trim();
                    // Ensure paragraph has meaningful content and isn't just whitespace/watermark
                    if (paragraphText.length > 10 && !containsWatermark(paragraphText)) {
                        cleanParagraphs.push(`<p>${paragraphText}</p>`);
                    }
                    currentParagraph = [];
                }
                
                currentNode = walker.nextNode();
            }
            
            // Add any remaining text as final paragraph
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join(' ').trim();
                if (paragraphText.length > 10 && !containsWatermark(paragraphText)) {
                    cleanParagraphs.push(`<p>${paragraphText}</p>`);
                }
            }
            
            // 3. If we have clean paragraphs, use them
            if (cleanParagraphs.length > 0) {
                // Additional filtering: remove any paragraph that contains watermark fragments
                const finalContent = cleanParagraphs.filter(p => {
                    const text = p.replace(/<[^>]*>/g, ''); // Strip HTML tags
                    return !containsWatermark(text);
                }).join('');
                
                if (finalContent.length > 100) {
                    return finalContent;
                }
            }
            
            // 4. Fallback: Direct content extraction with aggressive watermark removal
            const directText = contentElement.textContent || contentElement.innerText || "";
            const lines = directText.split('\n').map(line => line.trim()).filter(line => {
                return line.length > 10 && !containsWatermark(line);
            });
            
            if (lines.length > 0) {
                return lines.map(line => `<p>${line}</p>`).join('');
            }
            
            return "<p>Error: No content could be extracted.</p>";
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

(function() {
    // Check if script is already loaded
    if (window.NovelBuddyScrapers) {
        return;
    }

    const NOVELBUDDY_URL = "https://novelbuddy.com";

    /**
     * Internal helper function for string similarity
     * @param {string} s1 
     * @param {string} s2 
     * @returns {number}
     */
    function getSimilarity(s1, s2) {
        let longer = s1.toLowerCase();
        let shorter = s2.toLowerCase();
        if (s1.length < s2.length) {
            longer = s2.toLowerCase();
            shorter = s1.toLowerCase();
        }
        let longerLength = longer.length;
        if (longerLength == 0) {
            return 1.0;
        }
        return (longerLength - (longer.split('').filter((char, i) => char !== shorter[i])).length) / parseFloat(longerLength);
    }

    /**
     * Searches NovelBuddy for a query
     * @param {string} query 
     * @returns {Promise<Array>}
     */
    async function searchNovelBuddy(query) {
        const url = `${NOVELBUDDY_URL}/search?q=${encodeURIComponent(query)}`;
        try {
            const res = await fetch(url);
            const html = await res.text();
            const results = [];
            
            // --- DOMParser IMPLEMENTATION ---
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
            // --- END DOMParser ---
 
            return results;
        } catch (err) {
            console.error("[novel-plugin] NovelSearch Error:", err);
            return [];
        }
    }

    /**
     * Gets all chapter URLs and titles for a novel
     * @param {string} novelUrl 
     * @returns {Promise<Array>}
     */
    async function getNovelBuddyDetails(novelUrl) {
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
            
            // --- DOMParser IMPLEMENTATION ---
            const parser = new DOMParser();
            const doc = parser.parseFromString(chapterHtml, "text/html");
            const chapterItems = doc.querySelectorAll('ul.chapter-list li a');
            chapterItems.forEach(link => {
                const url = link.getAttribute('href');
                
                // --- FIX: Prioritize 'strong' tag, then fall back to 'title' attribute ---
                let title = link.querySelector('strong.chapter-title')?.textContent?.trim();
                if (!title || title.length === 0) {
                    // Fallback to title attribute if strong tag is missing/empty
                    title = link.getAttribute('title')?.trim() || "Unknown Chapter";
                }
                // --- END FIX ---
                
                if (url) {
                    chapters.push({ url: url, title: title });
                }
            });
            // --- END DOMParser ---
            return chapters.reverse(); // Reverse to get CH 1 first
        } catch (err) {
            console.error("[novel-plugin] NovelDetails Error:", err);
            return [];
        }
    }

    /**
     * Gets the processed HTML content for a single chapter
     * @param {string} chapterUrl 
     * @returns {Promise<string>}
     */
    async function getNovelBuddyChapterContent(chapterUrl) {
        const url = `${NOVELBUDDY_URL}${chapterUrl}`;
        try {
            const res = await fetch(url);
            const html = await res.text();
    
            // --- DOMParser IMPLEMENTATION ---
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const contentElement = doc.querySelector('.content-inner');
    
            if (!contentElement) {
                throw new Error("Could not extract chapter content.");
            }
    
            // 1. Remove specific unwanted elements (ads, scripts, etc.)
            contentElement.querySelectorAll('script').forEach(el => el.remove());
            contentElement.querySelectorAll('div[id^="pf-"]').forEach(el => el.remove());
            contentElement.querySelectorAll('div[style="text-align:center"]').forEach(el => el.remove());
            contentElement.querySelectorAll('ins').forEach(el => el.remove());
            contentElement.querySelectorAll('div[align="center"]').forEach(el => el.remove());
    
            // 2. Remove empty <div> tags that sometimes break up the text
            contentElement.querySelectorAll('div').forEach(div => {
                if (div.innerHTML.trim() === '') {
                    div.remove();
                }
            });
    
            return contentElement.innerHTML;
            // --- END DOMParser ---
    
        } catch (err) {
            console.error("[novel-plugin] ChapterContent Error:", err);
            return "<p>Error loading chapter content.</p>";
        }
    }

    /**
     * Tries to find the best match on NovelBuddy for an Anilist title
     * @param {string} romajiTitle 
     * @param {string} englishTitle 
     * @returns {Promise<Array>}
     */
    async function findNovelBuddyChapters(romajiTitle, englishTitle) {
        console.log(`[novel-plugin] Matching... looking for "${romajiTitle}"`);
        let searchResults = await searchNovelBuddy(romajiTitle);
        
        let bestMatch = null;
        let highestSimilarity = 0.0;
        if (searchResults && searchResults.length > 0) {
            searchResults.forEach(item => {
                const similarity = getSimilarity(romajiTitle, item.title);
                if (similarity > highestSimilarity) {
        
                    highestSimilarity = similarity;
                    bestMatch = item;
                }
            });
        }
        if (highestSimilarity <= 0.7 && englishTitle && englishTitle.toLowerCase() !== romajiTitle.toLowerCase()) {
            console.log(`[novel-plugin] No good match for Romaji title. Retrying with English: "${englishTitle}"`);
            searchResults = await searchNovelBuddy(englishTitle);
            
            bestMatch = null; 
            highestSimilarity = 0.0;
            if (searchResults && searchResults.length > 0) {
                searchResults.forEach(item => {
                    const similarity = getSimilarity(englishTitle, item.title);
                    if (similarity > highestSimilarity) {

                        highestSimilarity = similarity;
                        bestMatch = item;
                    }

                });
            }
        }
        if (highestSimilarity > 0.7 && bestMatch) {
            console.log(`[novel-plugin] Found match: "${bestMatch.title}" with similarity ${highestSimilarity.toFixed(2)}`);
            const chapters = await getNovelBuddyDetails(bestMatch.url);
            return chapters;
        } else {
            console.log(`[novel-plugin] No good match found. Best was "${bestMatch?.title}" (${highestSimilarity.toFixed(2)})`);
            return [];
        }
    }

    // Expose the public functions to the global window object
    window.NovelBuddyScrapers = {
        searchNovelBuddy,
        getNovelBuddyDetails,
        getNovelBuddyChapterContent,
        findNovelBuddyChapters
    };

    console.log('[novel-plugin] NovelBuddyScrapers loaded.');

})();

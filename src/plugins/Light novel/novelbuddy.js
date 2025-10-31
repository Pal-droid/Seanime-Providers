async function searchNovelBuddy(query) {
    const url = `${NOVELBUDDY_URL}/search?q=${encodeURIComponent(query)}`;
    try {
        const res = await fetch(url);
        const html = await res.text();
        const results = [];
        const itemRegex = /<div class="book-item">([\s\S]*?)<\/div>/g;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
            const block = match[1];
            const title = block.match(/<a title="([^"]+)"/)?.[1]?.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '') || "Unknown Title";
            const novelUrl = block.match(/href="(\/novel\/[^"]+)"/)?.[1] || "#";
            
            let image = block.match(/data-src="([^"]+)"/)?.[1] || "";
            if (image.startsWith("//")) { 
                image = `https:${image}`; 
            } else if (image.startsWith("/")) {
                image = `${NOVELBUDDY_URL}${image}`;
            }

            const latestChapter = block.match(/<span class="latest-chapter"[^>]*>([^<]+)<\/span>/)?.[1] || "No Chapter";
            
            results.push({ 
                title: title.trim(), 
                url: novelUrl, 
                image: image, 
                latestChapter: latestChapter.trim() 
            });
        }
        return results;
    } catch (err) {
        console.error("[novel-plugin] NovelSearch Error:", err);
        return [];
    }
}

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
        const chapterRegex = /<li[^>]*>[\s\S]*?<a href="([^"]+)" title="([^"]+)">/g;
        let chapterMatch;
        while ((chapterMatch = chapterRegex.exec(chapterHtml)) !== null) {
            chapters.push({ url: chapterMatch[1], title: chapterMatch[2].split(" - ").pop()?.trim() || "Unknown Chapter" });
        }
        return chapters.reverse();
    } catch (err) {
        console.error("[novel-plugin] NovelDetails Error:", err);
        return [];
    }
}

async function getNovelBuddyChapterContent(chapterUrl) {
    const url = `${NOVELBUDDY_URL}${chapterUrl}`;
    try {
        const res = await fetch(url);
        const html = await res.text();
        let contentHtml = html.match(/<div class="content-inner">([\s\S]*?)<\/div>/)?.[1];
        if (!contentHtml) {
            throw new Error("Could not extract chapter content.");
        }
        contentHtml = contentHtml.replace(/<script[\s\S]*?<\/` + `script>/gi, "");
        contentHtml = contentHtml.replace(/<div[^>]*id="pf-[^"]+"[^>]*>[\s\S]*?<\/div>/gi, "");
        contentHtml = contentHtml.replace(/<div[^>]*style="text-align:center"[^>]*>[\s\S]*?<\/div>/gi, "");
        contentHtml = contentHtml.replace(/<ins[^>]*>[\s\S]*?<\/ins>/gi, "");
        contentHtml = contentHtml.replace(/<div>\s*<div id="pf-[^"]+">[\s\S]*?<\/div>\s*<\/div>/gi, "");
        return contentHtml;
    } catch (err) {
        console.error("[novel-plugin] ChapterContent Error:", err);
        return "<p>Error loading chapter content.</p>";
    }
}

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

// ---------------------------------------------------------------
// NOVELBUDDY SCRAPERS (External Module)
// ---------------------------------------------------------------
// This file should be hosted, and its raw URL placed in
// 'SCRAPER_SCRIPT_URL' in ln-reader.js

// This URL is defined here because all functions in this file depend on it.
const NOVELBUDDY_URL = "https://novelbuddy.com";

/**
 * Searches NovelBuddy for a given query.
 * @param {string} query - The search term.
 * @returns {Promise<Array<Object>>} - A list of search result objects.
 */
export async function searchNovelBuddy(query) {
    const url = NOVELBUDDY_URL + "/search?q=" + encodeURIComponent(query);
    try {
        const res = await fetch(url);
        const html = await res.text();
        const results = [];
        const itemRegex = /<div class="book-item">([\s\S]*?)<\/div>/g;
        let m;
        while ((m = itemRegex.exec(html)) !== null) {
            const block = m[1];
            const title = (block.match(/<a title="([^"]+)"/) || [])[1]
                ?.replace(/<span[^>]*>/g, "").replace(/<\/span>/g, "") || "Unknown Title";
            const novelUrl = (block.match(/href="(\/novel\/[^"]+)"/) || [])[1] || "#";
            let image = (block.match(/data-src="([^"]+)"/) || [])[1] || "";
            if (image.startsWith("//")) image = "https:" + image;
            else if (image.startsWith("/")) image = NOVELBUDDY_URL + image;
            const latestChapter = (block.match(/<span class="latest-chapter"[^>]*>([^<]+)<\/span>/) || [])[1] || "No Chapter";
            results.push({ title: title.trim(), url: novelUrl, image, latestChapter: latestChapter.trim() });
        }
        return results;
    } catch (err) {
        console.error("[novel-plugin] NovelSearch Error:", err);
        return [];
    }
}

/**
 * Fetches the list of chapters for a given novel URL.
 * @param {string} novelUrl - The novel's path (e.g., /novel/my-novel).
 * @returns {Promise<Array<Object>>} - A list of chapter objects.
 */
export async function getNovelBuddyDetails(novelUrl) {
    const url = NOVELBUDDY_URL + novelUrl;
    try {
        const res = await fetch(url);
        const html = await res.text();
        const bookId = (html.match(/var bookId = (\d+);/) || [])[1];
        if (!bookId) throw new Error("No bookId");
        const chapterApiUrl = NOVELBUDDY_URL + "/api/manga/" + bookId + "/chapters?source=detail";
        const chapterRes = await fetch(chapterApiUrl);
        const chapterHtml = await chapterRes.text();
        const chapters = [];
        const chapterRegex = /<li[^>]*>[\s\S]*?<a href="([^"]+)" title="([^"]+)">/g;
        let cm;
        while ((cm = chapterRegex.exec(chapterHtml)) !== null) {
            chapters.push({ url: cm[1], title: (cm[2].split(" - ").pop() || "").trim() || "Unknown Chapter" });
        }
        return chapters.reverse();
    } catch (err) {
        console.error("[novel-plugin] NovelDetails Error:", err);
        return [];
    }
}

/**
 * Fetches the content of a specific chapter.
 * @param {string} chapterUrl - The chapter's path.
 * @returns {Promise<string>} - The HTML content of the chapter.
 */
export async function getNovelBuddyChapterContent(chapterUrl) {
    const url = NOVELBUDDY_URL + chapterUrl;
    try {
        const res = await fetch(url);
        const html = await res.text();
        let content = (html.match(/<div class="content-inner">([\s\S]*?)<\/div>/) || [])[1];
        if (!content) throw new Error("No content");
        content = content
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<div[^>]*id="pf-[^"]+"[^>]*>[\s\S]*?<\/div>/gi, "")
            .replace(/<div[^>]*style="text-align:center"[^>]*>[\s\S]*?<\/div>/gi, "")
            .replace(/<ins[^>]*>[\s\S]*?<\/ins>/gi, "")
            .replace(/<div>\s*<div id="pf-[^"]+">[\s\S]*?<\/div>\s*<\/div>/gi, "")
            .replace(/<a\s+(?:[^>]*?\s+)?href\s*=\s*(?:".*?"|'.*?'|[^>\s]+)[^>]*?>[\s\S]*?<\/a>/gi, "");
        return content;
    } catch (err) {
        console.error("[novel-plugin] ChapterContent Error:", err);
        return "<p>Error loading chapter content.</p>";
    }
}

/**
 * Helper function to calculate string similarity.
 * @param {string} s1
 * @param {string} s2
 * @returns {number} - A score from 0 to 1.
 */
export function getSimilarity(s1, s2) {
    let longer = s1.toLowerCase(), shorter = s2.toLowerCase();
    if (s1.length < s2.length) [longer, shorter] = [shorter, longer];
    const len = longer.length;
    if (len === 0) return 1.0;
    return (len - longer.split("").filter((c, i) => c !== shorter[i]).length) / len;
}

/**
 * Tries to find the best NovelBuddy match for an Anilist novel.
 * @param {string} romaji - The romaji title.
 * @param {string} english - The english title.
 * @returns {Promise<Array<Object>>} - A list of chapter objects if a good match is found.
 */
export async function findNovelBuddyChapters(romaji, english) {
    // Note: This function calls other exported functions from this same module.
    // No 'window.novelScrapers' prefix is needed here.
    let results = await searchNovelBuddy(romaji);
    let best = null, bestScore = 0;
    results.forEach(r => {
        const score = getSimilarity(romaji, r.title);
        if (score > bestScore) { bestScore = score; best = r; }
    });
    if (bestScore <= 0.7 && english && english.toLowerCase() !== romaji.toLowerCase()) {
        results = await searchNovelBuddy(english);
        best = null; bestScore = 0;
        results.forEach(r => {
            const score = getSimilarity(english, r.title);
            if (score > bestScore) { bestScore = score; best = r; }
        });
    }
    if (bestScore > 0.7 && best) return await getNovelBuddyDetails(best.url);
    return [];
}

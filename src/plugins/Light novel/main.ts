/// <reference path="./core.d.ts" />

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------

/**
 * The structure of a single search result from searchNovels.
 */
type NovelSearchResult = {
    title: string;
    url: string;
    image: string;
    latestChapter: string;
};

/**
 * The structure of a novel's details from getNovelDetails.
 */
type NovelDetails = {
    title: string;
    image: string;
    author: string;
    status: string;
    genres: string[];
    description: string;
    chapters: Array<{ title: string, url: string }>;
};


/**
 * This is the main entrypoint for your plugin.
 */
function init() {
    // Register the UI context to gain access to UI-related APIs.
    $ui.register((ctx) => {

        // 1. CREATE THE TRAY ICON
        const tray = ctx.newTray({
            tooltipText: "Novel Reader",
            // UPDATED: Set icon to the novelbuddy.ico URL
            iconUrl: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/public/novelbuddy.ico",
            withContent: true,
        });

        // 2. DEFINE PLUGIN STATE
        // We manage the UI's "page"
        const pageState = ctx.state<"search" | "results" | "chapters" | "reader">("search");
        // Used to show loading indicators
        const isLoading = ctx.state<boolean>(false);
        // Holds the list of novels after searching
        const searchResults = ctx.state<NovelSearchResult[]>([]);
        // Holds the details of the currently selected novel
        const currentNovel = ctx.state<NovelDetails | null>(null);
        // Holds the raw HTML content of the selected chapter
        const currentChapterContent = ctx.state<string | null>(null);

        // Create a reference for the search input field
        const searchInputRef = ctx.fieldRef<string>("");


        // 3. RENDER THE TRAY UI
        // This function is re-run every time a state it uses (e.g., pageState.get()) changes.
        tray.render(() => {
            const state = pageState.get();
            const loading = isLoading.get();

            // Central loading indicator
            if (loading) {
                return tray.stack([
                    tray.text("Loading...", { style: { padding: "1.5rem", textAlign: "center", opacity: 0.8 } })
                ]);
            }

            // -------------------------
            // STATE 1: SEARCH VIEW
            // -------------------------
            if (state === "search") {
                return tray.stack([
                    tray.text("Novel Reader", { style: { fontWeight: "bold", fontSize: 16, margin: "0 0 0.5rem 0" } }),

                    // Use tray.input with the fieldRef, as per the new docs
                    tray.input("Search for a novel", {
                        fieldRef: searchInputRef,
                        placeholder: "e.g., Classroom of the Elite"
                    }),

                    tray.button("Search", {
                        onClick: ctx.eventHandler("search-btn", async () => {
                            // Get the value from the ref's .current property
                            const query = searchInputRef.current;
                            if (query.trim() === "") return;

                            isLoading.set(true);
                            const results = await searchNovels(ctx, query);
                            searchResults.set(results);
                            isLoading.set(false);
                            pageState.set("results");
                        }),
                        style: { marginTop: "0.5rem" }
                    })
                ], { style: { padding: "1rem" } });
            }

            // -------------------------
            // STATE 2: RESULTS VIEW
            // -------------------------
            if (state === "results") {
                const results = searchResults.get();

                // Map results to tray.flex components
                const resultItems = results.map(item =>
                    tray.flex([
                        tray.stack([
                            tray.text(item.title, { style: { fontWeight: "500", fontSize: 13 } }),
                            tray.text(item.latestChapter, { style: { fontSize: 11, opacity: 0.7 } })
                        ], { style: { flex: 1, overflow: "hidden" } }),

                        tray.button("View", {
                            size: "sm",
                            intent: "info",
                            onClick: ctx.eventHandler(item.url, async () => {
                                isLoading.set(true);
                                const details = await getNovelDetails(ctx, item.url);
                                currentNovel.set(details);
                                isLoading.set(false);
                                pageState.set("chapters");
                            })
                        })
                    ], { gap: 2, style: { borderBottom: "1px solid #333", padding: "0.5rem 0" } })
                );

                return tray.stack([
                    tray.button("← Back", {
                        onClick: ctx.eventHandler("back-to-search", () => pageState.set("search")),
                        size: "sm",
                        intent: "gray-subtle"
                    }),
                    tray.text("Search Results", { style: { fontWeight: "bold", fontSize: 16, margin: "0.5rem 0" } }),
                    ...(resultItems.length > 0 ? resultItems : [tray.text("No results found.", { style: { padding: "1rem", textAlign: "center", opacity: 0.8 } })])
                ], { style: { padding: "1rem" } });
            }

            // -------------------------
            // STATE 3: CHAPTERS VIEW
            // -------------------------
            if (state === "chapters") {
                const novel = currentNovel.get();
                if (!novel) {
                    pageState.set("results"); // Go back if no novel
                    return;
                }

                // Map chapters to tray.flex components
                const chapterItems = novel.chapters.map(chapter =>
                    tray.flex([
                        tray.text(chapter.title, { style: { flex: 1, fontSize: 13, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } }),
                        tray.button("Read", {
                            size: "sm",
                            intent: "info",
                            onClick: ctx.eventHandler(chapter.url, async () => {
                                isLoading.set(true);
                                const content = await getChapterContent(ctx, chapter.url);
                                currentChapterContent.set(content);
                                isLoading.set(false);
                                pageState.set("reader");
                            })
                        })
                    ], { gap: 2, style: { borderBottom: "1px solid #333", padding: "0.5rem 0" } })
                );

                return tray.stack([
                    tray.button("← Back", {
                        onClick: ctx.eventHandler("back-to-results", () => pageState.set("results")),
                        size: "sm",
                        intent: "gray-subtle"
                    }),
                    tray.text(novel.title, { style: { fontWeight: "bold", fontSize: 16, margin: "0.5rem 0" } }),
                    tray.text(`Author: ${novel.author}`, { style: { fontSize: 12, opacity: 0.8, marginBottom: "0.5rem" } }),
                    ...(chapterItems.length > 0 ? chapterItems : [tray.text("No chapters found.", { style: { padding: "1rem", textAlign: "center", opacity: 0.8 } })])
                ], { style: { padding: "1rem" } });
            }

            // -------------------------
            // STATE 4: READER VIEW
            // -------------------------
            if (state === "reader") {
                const contentHtml = currentChapterContent.get();
                const novel = currentNovel.get();

                if (!contentHtml || !novel) {
                    pageState.set("chapters"); // Go back if no content
                    return;
                }

                // Convert chapter HTML to plain text for the tray.text component
                // Replace paragraphs and line breaks with newlines, strip other tags
                const plainText = contentHtml
                    .replace(/<p>/gi, "\n\n")
                    .replace(/<\/p>/gi, "")
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<[^>]+>/g, "")
                    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
                    .replace(/&amp;/g, '&')  // Replace HTML entities
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();

                return tray.stack([
                    tray.button("← Back", {
                        onClick: ctx.eventHandler("back-to-chapters", () => pageState.set("chapters")),
                        size: "sm",
                        intent: "gray-subtle"
                    }),
                    tray.text(novel.title, { style: { fontWeight: "bold", fontSize: 16, margin: "0.5rem 0" } }),
                    // Added a scrollable container for the text
                    tray.div([
                        tray.text(plainText, { style: { fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 } })
                    ], { style: { maxHeight: '60vh', overflowY: 'auto', marginTop: '0.5rem' }})
                ], { style: { padding: "1rem" } });
            }

        }); // End of tray.render

        // ---------------------------------------------------------------------------
        // SCRAPING FUNCTIONS (USING REGEX)
        // ---------------------------------------------------------------------------

        const NOVELBUDDY_URL = "https://novelbuddy.com";

        async function searchNovels(ctx, query: string): Promise<NovelSearchResult[]> {
            const url = `${NOVELBUDDY_URL}/search?q=${encodeURIComponent(query)}`;
            try {
                const res = await ctx.fetch(url);
                const html = await res.text();

                const results: NovelSearchResult[] = [];
                // Regex to find each book item block
                const itemRegex = /<div class="book-item">([\s\S]*?)<\/div>/g;
                let match;

                while ((match = itemRegex.exec(html)) !== null) {
                    const block = match[1];
                    // Extract data within the block using more specific regex
                    const title = block.match(/<a title="([^"]+)"/)?.[1]?.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '') || "Unknown Title"; // Clean spans from title
                    const novelUrl = block.match(/href="(\/novel\/[^"]+)"/)?.[1] || "#";
                    // Handle potential // prefix for image URLs
                    let image = block.match(/data-src="([^"]+)"/)?.[1] || "";
                    if (image.startsWith("//")) {
                       image = `https:${image}`;
                    } else if (!image.startsWith("http")) {
                       // Handle cases where it might be a relative path (less likely but possible)
                       image = `${NOVELBUDDY_URL}${image}`;
                    }
                    const latestChapter = block.match(/<span class="latest-chapter"[^>]*>([^<]+)<\/span>/)?.[1] || "No chapter"; // Adjusted regex for latest chapter

                    results.push({
                        title: title.trim(),
                        url: novelUrl,
                        image: image,
                        latestChapter: latestChapter.trim()
                    });
                }
                console.log(`[novel-plugin] Parsed ${results.length} items from search page.`);
                return results;

            } catch (err) {
                console.error("[novel-plugin] NovelSearch Error:", err);
                return [];
            }
        }

        async function getNovelDetails(ctx, novelUrl): Promise<NovelDetails | null> {
            const url = `${NOVELBUDDY_URL}${novelUrl}`;
            try {
                // --- Step 1: Fetch the main novel page to get details and bookId ---
                const res = await ctx.fetch(url);
                const html = await res.text();

                const title = html.match(/<h1 class="name">([^<]+)<\/h1>/)?.[1]?.trim() || "Unknown Title";
                // Handle potential // prefix for image URLs
                 let image = html.match(/<div class="book-img"[^>]*><img[^>]*src="([^"]+)"/)?.[1] || "";
                 if (image.startsWith("//")) {
                    image = `https:${image}`;
                 } else if (!image.startsWith("http")) {
                    image = `${NOVELBUDDY_URL}${image}`;
                 }
                const author = html.match(/<div class="author"[^>]*>[\s\S]*?<span class="name">([^<]+)<\/span>/)?.[1]?.trim() || "Unknown Author";
                const status = html.match(/<div class="status"[^>]*>[\s\S]*?<span class="text">([^<]+)<\/span>/)?.[1]?.trim() || "Unknown";
                const description = html.match(/<div class="summary"[^>]*>[\s\S]*?<div class="content">([\s\S]*?)<\/div>/)?.[1] || "<p>No description.</p>";

                const genres: string[] = [];
                const genreMatches = [...html.matchAll(/<a href="\/genre\/[^"]+"[^>]*>([^<]+)<\/a>/g)];
                for (const g of genreMatches) {
                    genres.push(g[1].trim());
                }

                // --- Step 2: Extract bookId to fetch chapters ---
                const bookIdMatch = html.match(/var bookId = (\d+);/);
                if (!bookIdMatch || !bookIdMatch[1]) {
                    console.error("[novel-plugin] Could not find bookId on novel page:", url);
                    return { // Return partial details even if chapters fail
                        title, image, author, status, genres, description, chapters: []
                    };
                }
                const bookId = bookIdMatch[1];
                const chapterApiUrl = `${NOVELBUDDY_URL}/api/manga/${bookId}/chapters?source=detail`;

                // --- Step 3: Fetch the chapter list from the API ---
                const chapterRes = await ctx.fetch(chapterApiUrl);
                const chapterHtml = await chapterRes.text();

                const chapters: Array<{ title: string, url: string }> = [];
                // Regex adjusted for the API response structure
                const chapterRegex = /<li[^>]*>[\s\S]*?<a href="([^"]+)" title="([^"]+)">/g;
                let chapterMatch;

                while ((chapterMatch = chapterRegex.exec(chapterHtml)) !== null) {
                    chapters.push({
                        url: chapterMatch[1],
                        // Extract just the chapter title part from the full title attribute if needed
                        title: chapterMatch[2].split(" - ").pop()?.trim() || "Unknown Chapter"
                    });
                }
                 console.log(`[novel-plugin] Parsed ${chapters.length} chapters for bookId ${bookId}.`);


                return {
                    title,
                    image,
                    author,
                    status,
                    genres,
                    description,
                    // Chapters from API are newest first, reverse them for correct order
                    chapters: chapters.reverse()
                };

            } catch (err) {
                console.error("[novel-plugin] NovelDetails Error:", err);
                return null;
            }
        }

        async function getChapterContent(ctx, chapterUrl): Promise<string> {
            const url = `${NOVELBUDDY_URL}${chapterUrl}`;
            try {
                const res = await ctx.fetch(url);
                const html = await res.text();

                // Regex to find the main content div
                // UPDATED: Changed class from "content-story" to "content-inner"
                let contentHtml = html.match(/<div class="content-inner">([\s\S]*?)<\/div>/)?.[1];

                if (!contentHtml) {
                    console.error("[novel-plugin] Could not find content-inner div for chapter:", url);
                    return "<p>Error: Could not extract chapter content.</p>";
                }

                // Remove scripts and known ad/placeholder divs more aggressively
                contentHtml = contentHtml.replace(/<script[\s\S]*?<\/script>/gi, "");
                contentHtml = contentHtml.replace(/<div[^>]*id="pf-[^"]+"[^>]*>[\s\S]*?<\/div>/gi, ""); // Remove specific ad divs by ID pattern
                contentHtml = contentHtml.replace(/<div[^>]*style="text-align:center"[^>]*>[\s\S]*?<\/div>/gi, ""); // Remove centered divs likely containing ads/placeholders
                contentHtml = contentHtml.replace(/<ins[^>]*>[\s\S]*?<\/ins>/gi, ""); // Remove <ins> tags (often ads)
                contentHtml = contentHtml.replace(/<div>\s*<div id="pf-[^"]+">[\s\S]*?<\/div>\s*<\/div>/gi, ""); // Remove ad divs wrapped in another div

                // Return just the inner HTML content
                return contentHtml;

            } catch (err) {
                console.error("[novel-plugin] ChapterContent Error:", err);
                return "<p>Error loading chapter content.</p>";
            }
        }


    }); // End of $ui.register
}



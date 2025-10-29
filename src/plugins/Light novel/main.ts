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
        // This creates the icon in the seanime tray.
        const tray = ctx.newTray({
            tooltipText: "Novel Reader",
            // Using a simple book icon
            iconUrl: "https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/png/book.png",
            withContent: true,
        });

        // 2. DEFINE PLUGIN STATE
        // We manage the UI's "page"
        const pageState = ctx.state<"search" | "results" | "chapters" | "reader">("search");
        // Holds the text from the search input
        const searchQuery = ctx.state<string>("");
        // Used to show loading indicators
        const isLoading = ctx.state<boolean>(false);
        // Holds the list of novels after searching
        const searchResults = ctx.state<NovelSearchResult[]>([]);
        // Holds the details of the currently selected novel
        const currentNovel = ctx.state<NovelDetails | null>(null);
        // Holds the raw HTML content of the selected chapter
        const currentChapterContent = ctx.state<string | null>(null);


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
                    // NOTE: This assumes a `tray.input` component exists, as it's
                    // essential for search. This follows a standard reactive UI pattern.
                    tray.input({
                        value: searchQuery.get(),
                        placeholder: "Search NovelBuddy...",
                        onChange: ctx.eventHandler("search-onchange", (val) => searchQuery.set(val))
                    }),
                    tray.button("Search", {
                        onClick: ctx.eventHandler("search-btn", async () => {
                            if (searchQuery.get().trim() === "") return;
                            
                            isLoading.set(true);
                            const results = await searchNovels(ctx, searchQuery.get());
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
                    ...resultItems
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
                        tray.text(chapter.title, { style: { flex: 1, fontSize: 13, overflow: "hidden" } }),
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
                    ...chapterItems
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
                // This is a simple conversion; a more robust one might be needed.
                const plainText = contentHtml
                    .replace(/<p>/gi, "\n") // Replace <p> with newlines
                    .replace(/<\/p>/gi, "\n")
                    .replace(/<br\s*\/?>/gi, "\n") // Replace <br> with newlines
                    .replace(/<[^>]+>/g, ""); // Strip all other tags

                return tray.stack([
                    tray.button("← Back", {
                        onClick: ctx.eventHandler("back-to-chapters", () => pageState.set("chapters")),
                        size: "sm",
                        intent: "gray-subtle"
                    }),
                    tray.text(novel.title, { style: { fontWeight: "bold", fontSize: 16, margin: "0.5rem 0" } }),
                    tray.text(plainText, { style: { fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 } })
                ], { style: { padding: "1rem" } });
            }

        }); // End of tray.render
        
        // ---------------------------------------------------------------------------
        // SCRAPING FUNCTIONS (Moved inside $ui.register to access ctx)
        // ---------------------------------------------------------------------------

        const NOVELBUDDY_URL = "https://novelbuddy.com";

        async function searchNovels(ctx, query): Promise<NovelSearchResult[]> {
            const url = `${NOVELBUDDY_URL}/search?q=${encodeURIComponent(query)}`;
            try {
                const res = await ctx.fetch(url);
                const html = await res.text();
                const $ = LoadDoc(html);

                const results: NovelSearchResult[] = [];
                $("div.book-item").each((i, el) => {
                    const $el = $(el);
                    const title = $el.find("h3 > a").attr("title");
                    const novelUrl = $el.find("h3 > a").attr("href");
                    const image = $el.find("img.lazy").attr("data-src");
                    const latestChapter = $el.find("span.latest-chapter").attr("title");
                    
                    results.push({
                        title: title,
                        url: novelUrl,
                        image: image.startsWith("http") ? image : `https:${image}`,
                        latestChapter: latestChapter
                    });
                });
                return results;

            } catch (err) {
                console.error("NovelSearch Error:", err.message);
                return [];
            }
        }

        async function getNovelDetails(ctx, novelUrl): Promise<NovelDetails | null> {
            const url = `${NOVELBUDDY_URL}${novelUrl}`;
            try {
                const res = await ctx.fetch(url);
                const html = await res.text();
                const $ = LoadDoc(html);

                const title = $("div.book-info h1.name").text().trim();
                const image = $("div.book-img img").attr("src");
                const author = $("div.author span.name").text().trim();
                const status = $("div.status span.text").text().trim();
                const description = $("div.summary div.content").html();
                
                const genres: string[] = [];
                $('div.meta-data a[href*="/genre/"]').each((i, el) => {
                    genres.push($(el).text().trim());
                });

                const chapters: Array<{ title: string, url: string }> = [];
                $("ul.list-chapters li.chapter-item").each((i, el) => {
                    const $el = $(el);
                    const title = $el.find("a").attr("title");
                    const chapterUrl = $el.find("a").attr("href");
                    chapters.push({
                        title: title,
                        url: chapterUrl
                    });
                });

                return {
                    title,
                    image,
                    author,
                    status,
                    genres,
                    description,
                    chapters: chapters.reverse()
                };

            } catch (err) {
                console.error("NovelDetails Error:", err.message);
                return null;
            }
        }

        async function getChapterContent(ctx, chapterUrl): Promise<string> {
            const url = `${NOVELBUDDY_URL}${chapterUrl}`;
            try {
                const res = await ctx.fetch(url);
                const html = await res.text();
                const $ = LoadDoc(html);

                const contentElement = $("div.content-story");
                contentElement.find("script, div[id^='pf-']").remove();
                
                return `<div class="content-story">${contentElement.html()}</div>`;

            } catch (err) {
                console.error("ChapterContent Error:", err.message);
                return "<p>Error loading chapter content.</p>";
            }
        }


    }); // End of $ui.register
}



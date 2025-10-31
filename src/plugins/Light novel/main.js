/// <reference path="./core.d.ts" />

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------

type AnilistMedia = { id: number, title: { romaji: string, english: string }, /* ... */ };
type NovelBuddySearchResult = { title: string, url: string, image?: string, latestChapter?: string };
type NovelBuddyDetails = { title: string, /* ... */ chapters: Array<{ title: string, url: string }> };


// ---------------------------------------------------------------------------
// MAIN ENTRYPOINT
// ---------------------------------------------------------------------------

function init() {
    // 1. Register the UI context
    $ui.register((ctx) => {
        console.log("[novel-plugin] $ui.register() called.");

        // ---------------------------------------------------------------------------
        // INJECTED SCRIPT BUILDER 
        // ---------------------------------------------------------------------------

        /**
         * Fetches the raw text content of a file from a URL.
         */
        async function fetchScriptText(url) {
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`Failed to fetch script: ${res.status} ${res.statusText}`);
                }
                return await res.text();
            } catch (err) {
                console.error(`[novel-plugin] FATAL: Could not fetch script at ${url}`, err);
                return ""; // Return empty string on failure
            }
        }

        /**
         * Creates the constants string locally, as it depends on the runtime scriptId.
         */
        function getConstantsString(scriptId: string): string {
            return `
            const SCRIPT_ID = "${scriptId}";
            const NOVELBUDDY_URL = "https://novelbuddy.com";
            const ANILIST_API_URL = "https://graphql.anilist.co";
            
            // DOM IDs
            const STYLE_ID = "novel-plugin-styles";
            const BACKDROP_ID = "novel-plugin-backdrop";
            const MODAL_ID = "novel-plugin-modal-content";
            const WRAPPER_ID = "novel-plugin-content-wrapper";
            const CLOSE_BTN_ID = "novel-plugin-btn-close";
            const SEARCH_INPUT_ID = "novel-plugin-search-input";
            
            const APP_LAYOUT_SELECTOR = ".UI-AppLayout__root";
            `;
        }

        /**
         * Fetches all external script parts and assembles them into a single string.
         */
        async function getInjectedScriptString(scriptId: string): Promise<string> {
            const urls = {
                main: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/plugins/Light%20novel/main.ts",
                utils: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/plugins/Light%20novel/utils.js",
                anilistApi: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/plugins/Light%20novel/anilist.js",
                novelbuddyApi: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/plugins/Light%20novel/novelbuddy.js",
                ui: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/plugins/Light%20novel/ui.js"
            };

            const [
                mainTemplate,
                utilsCode,
                anilistApiCode,
                novelbuddyApiCode,
                uiCode
            ] = await Promise.all([
                fetchScriptText(urls.main),
                fetchScriptText(urls.utils),
                fetchScriptText(urls.anilistApi),
                fetchScriptText(urls.novelbuddyApi),
                fetchScriptText(urls.ui)
            ]);

            if (!mainTemplate) {
                console.error("[novel-plugin] FATAL: Could not load main template. Aborting.");
                return ""; // Return empty string if the core template fails
            }

            // Assemble the final script by replacing placeholders
            const finalScript = mainTemplate
                .replace("%%CONSTANTS%%", getConstantsString(scriptId))
                .replace("%%PLUGIN_STATE%%", `
                    let pageState = "discover";
                    let activeTabState = "discover";
                    let isLoading = false;
                    let currentNovel = null;
                    let currentChapterContent = null;
                    let currentNovelBuddyChapters = [];
                    const mainLayout = document.querySelector(APP_LAYOUT_SELECTOR);
                `)
                .replace("%%UTILS%%", utilsCode)
                .replace("%%ANILIST_API%%", anilistApiCode)
                .replace("%%NOVELBUDDY_API%%", novelbuddyApiCode)
                .replace("%%UI%%", uiCode);

            return finalScript;
        }

        // 2. Create the Tray Icon
        const tray = ctx.newTray({
            tooltipText: "Novel Reader",
            iconUrl: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/public/novelbuddy.ico",
            withContent: false,
        });

        // 3. Set up the Tray Click Handler
        tray.onClick(async () => {
            console.log("[novel-plugin] Tray clicked.");
            
            try {
                const existingModal = await ctx.dom.queryOne(`#${"novel-plugin-backdrop"}`);
                if (existingModal) {
                    console.log("[novel-plugin] Modal is already open. Aborting.");
                    return;
                }
                
                const body = await ctx.dom.queryOne("body");
                if (!body) {
                    console.error("[novel-plugin] FATAL: Could not find <body>!");
                    return;
                }
                
                const scriptId = `novel-plugin-script-${Date.now()}`;
                const script = await ctx.dom.createElement("script");
                script.setAttribute("data-novel-plugin-id", scriptId);
                
                // Fetch and assemble the script string
                const scriptText = await getInjectedScriptString(scriptId);
                if (scriptText) {
                    script.setText(scriptText);
                    body.append(script);
                    console.log(`[novel-plugin] Injected script tag #${scriptId}`);
                } else {
                    console.error("[novel-plugin] Failed to build script, not injecting.");
                }

            } catch (err) {
                console.error("[novel-plugin] FATAL ERROR in tray.onClick():", err);
            }
        }); // End of tray.onClick
    }); // End of $ui.register
}


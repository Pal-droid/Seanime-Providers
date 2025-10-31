/**
 * This script is the core entry point injected into the host application.
 * It contains the main state, the openNovelPage function, and the primary
 * event listeners for the novel reader modal.
 */

// %%CONSTANTS%% is replaced by the injected script builder
// %%UTILS%% is replaced by utility functions (e.g., htmlToElement)
// %%ANILIST_API%% is replaced by Anilist API functions
// %%NOVELBUDDY_API%% is replaced by NovelBuddy API functions
// %%UI%% is replaced by UI rendering functions

// %%PLUGIN_STATE%% is replaced by state initialization variables like:
/*
    let pageState = "discover";
    let activeTabState = "discover";
    let isLoading = false;
    let currentNovel = null;
    // ... and others
*/

// Note: The global state variables (pageState, isLoading, mainLayout, etc.)
// are assumed to be declared and initialized by the %%PLUGIN_STATE%% block
// that wraps this code during injection.

/**
 * Opens the main novel reader modal, injects the backdrop and modal structure,
 * and fetches the external CSS.
 */
async function openNovelPage() {
    // Hide the main application layout while the modal is open
    // 'mainLayout' is assumed to be defined in %%PLUGIN_STATE%%
    if (mainLayout) mainLayout.style.display = "none";
    
    // Promise to handle the CSS loading before rendering content
    const loadCss = new Promise(async (resolve, reject) => {
        // !! IMPORTANT !!
        // This URL must be correct in your final version
        // NOTE: This is the critical section you were asking about.
        const cssUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/src/plugins/Light%20novel/anilist-styles.css";
        
        try {
            console.log(`[novel-plugin] Attempting to fetch CSS from: ${cssUrl}`);
            const res = await fetch(cssUrl); // <-- The CSS fetch happens here
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            const cssText = await res.text();
            
            // Check if styles are already injected
            if (!document.getElementById(STYLE_ID)) {
                const style = document.createElement("style");
                style.id = STYLE_ID;
                style.textContent = cssText;
                document.head.appendChild(style);
                console.log("[novel-plugin] External CSS fetched and injected.");
            } else {
                console.log("[novel-plugin] CSS already present.");
            }
            resolve(true);
        } catch (err) {
            console.error("[novel-plugin] Failed to fetch or inject CSS:", err);
            // We resolve true anyway to allow the UI to load, even if unstyled
            resolve(false); 
        }
    });

    // Wait for the CSS to load (or fail gracefully)
    await loadCss;

    // Build the modal HTML (using functions from the injected %%UI%% block)
    const backdropHtml = renderBackdrop(); // Assumed to be in ui.js
    const backdropElement = htmlToElement(backdropHtml); // Assumed to be in utils.js

    // Append to body
    document.body.appendChild(backdropElement);
    console.log("[novel-plugin] Modal backdrop rendered.");

    // Initial render of the content based on current state
    updateModalContent(); // Assumed to be in ui.js

    // Setup event listeners for the modal
    setupEventListeners();

    // Trigger initial search for AniList
    fetchAniListMedia(); // Assumed to be in anilist.js
}

/**
 * Closes the novel reader modal and cleans up the injected elements.
 */
function closeNovelPage() {
    const backdrop = document.getElementById(BACKDROP_ID);
    if (backdrop) {
        backdrop.remove();
        console.log("[novel-plugin] Modal closed and backdrop removed.");
    }
    
    // Restore the main application layout
    if (mainLayout) mainLayout.style.display = "flex"; // Assuming 'flex' for layout
}

/**
 * Sets up listeners for closing the modal and handling other modal events.
 */
function setupEventListeners() {
    const backdrop = document.getElementById(BACKDROP_ID);
    if (backdrop) {
        // Close button listener
        const closeBtn = document.getElementById(CLOSE_BTN_ID);
        closeBtn?.addEventListener("click", closeNovelPage);

        // Backdrop click listener (to close when clicking outside the modal)
        backdrop.addEventListener("click", (event) => {
            // Check if the click target is the backdrop itself
            if (event.target === backdrop) {
                closeNovelPage();
            }
        });

        // Keydown listener for ESC to close
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeNovelPage();
            }
        });
    }

    // Add search input listeners (assuming this is handled in ui.js or here)
    // const searchInput = document.getElementById(SEARCH_INPUT_ID);
    // searchInput?.addEventListener("input", handleSearchInput);
}

// Ensure the main function is exported or called if needed
// This script is usually invoked right after injection
// openNovelPage is called by the tray.onClick event listener in the outer plugin file
// But since this is the "main" script, we assume a setup function is needed
function novelPluginMain() {
    // In a fully assembled script, this function is the entry point
    console.log("[novel-plugin] Injected script started running.");
    
    // The main execution logic will be handled by the listener in the outer script
    // which calls openNovelPage()
}
// Run the setup function if necessary, or rely on the host to call openNovelPage()
// novelPluginMain(); 

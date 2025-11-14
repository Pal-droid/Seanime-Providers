/// <reference path="./core.d.ts" />

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS (These are for reference, not used by the injected script)
// ---------------------------------------------------------------------------

type AnilistMedia = {
    id: number;
    title: { romaji: string; english: string; };
    coverImage: { extraLarge: string; large: string; color: string; };
    description?: string;
    genres?: string[];
    status?: string;
    bannerImage?: string;
    averageScore?: number;
    startDate?: { year: number };
    // --- NEWLY ADDED TYPES ---
    tags?: Array<{ id: number; name: string; isMediaSpoiler: boolean; }>;
    rankings?: Array<{ id: number; rank: number; type: string; context: string; allTime: boolean; }>;
    externalLinks?: Array<{ id: number; url: string; site: string; icon?: string; }>;
    characters?: { edges: Array<{ role: string; node: { id: number; name: { full: string }; image: { large: string }; }; }> };
    staff?: { edges: Array<{ role: string; node: { id: number; name: { full: string }; image: { large: string }; }; }> };
    recommendations?: { nodes: Array<{ mediaRecommendation: AnilistMedia } > };
    reviews?: { nodes: Array<{ id: number; summary: string; score: number; user: { name: string; avatar: { large: string } }; }> };
};

// Updated to include image and chapter for manual match UI
type NovelBuddySearchResult = {
    title: string;
    url: string;
    image?: string;
    latestChapter?: string;
};

type NovelBuddyDetails = {
    title: string;
    image: string;
    author: string;
    status: string;
    genres: string[];
    description: string;
    chapters: Array<{ title: string, url: string }>;
};

// ---------------------------------------------------------------------------
// MAIN ENTRYPOINT
// ---------------------------------------------------------------------------

function init() {
    // 1. Register the UI context
    $ui.register((ctx) => {
        console.log("[novel-plugin] $ui.register() called.");

        // ---------------------------------------------------------------------------
        // INJECTED SCRIPT BUILDER (MOVED INSIDE REGISTER)
        // ---------------------------------------------------------------------------

        /**
         * This function generates the complete, self-contained plugin script as a string.
         * @param {string} scriptId - A unique ID for the script tag so it can remove itself.
         */
        function getInjectedScriptString(scriptId: string): string {
            
            // We use a template literal to build the entire script.
            // All backticks (`) and template literal tokens (${) MUST be escaped (e.g., \` and \${)
            // inside this string so they are interpreted by the injected script, not by the outer function.
            return `
        (async function() {
      
            // ---------------------------------------------------------------------------
            // 1. SETUP & CONFIG
            // ---------------------------------------------------------------------------
            
            if (document.getElementById("novel-plugin-modal-content")) {
                console.log("[novel-plugin] Modal already exists.");
                return;
            }
            console.log("[novel-plugin] Injected script running.");
            const SCRIPT_ID = "${scriptId}";
            // const NOVELBUDDY_URL = "https://novelbuddy.com"; // <-- MOVED
            // const ANILIST_API_URL = "https://graphql.anilist.co"; // <-- MOVED
            
            // DOM IDs
            const STYLE_ID = "novel-plugin-styles";
            const SCRIPT_QUERY_ID = "novel-plugin-queries";
            const SCRIPT_SCRAPER_ID = "novel-plugin-scrapers"; // <-- ADDED
            const BACKDROP_ID = "novel-plugin-backdrop";
            const MODAL_ID = "novel-plugin-modal-content";
            const WRAPPER_ID = "novel-plugin-content-wrapper";
            const CLOSE_BTN_ID = "novel-plugin-btn-close";
            const SEARCH_INPUT_ID = "novel-plugin-search-input";
            const APP_LAYOUT_SELECTOR = ".UI-AppLayout__root";
        
            // ---------------------------------------------------------------------------
            // 2. PLUGIN STATE
            // ---------------------------------------------------------------------------
            let pageState = "discover";
            let activeTabState = "discover";
            let isLoading = false;
            let currentNovel = null; // Holds full Anilist media object
            let currentChapterContent = null;
            let currentNovelBuddyChapters = []; // Holds { title, url }
            let currentChapterIndex = -1; // NEW: Track current chapter index
            
            const mainLayout = document.querySelector(APP_LAYOUT_SELECTOR);
            // ---------------------------------------------------------------------------
            // 3. STYLES & HTML (Injected)
            // ---------------------------------------------------------------------------
            
            function getModalHtml() {
                // New modal with tabs for navigation
                return (
    
                    '<div id="' + MODAL_ID + '">' +
                    '    <button id="' + CLOSE_BTN_ID + '"></button>' + // X is now added via CSS
                    '    <div class="novel-plugin-header">' +
               
                    '       <div class="novel-plugin-tabs">' +
                    '           <button class="novel-plugin-tab" id="novel-plugin-tab-discover" data-page="discover">Discover</button>' +
                    '           <button class="novel-plugin-tab" id="novel-plugin-tab-search" data-page="search">Search</button>' +
                
                    '       </div>' +
                    '    </div>' +
                    '    <div id="' + WRAPPER_ID + '">' +
                    '        ' + // Content will 
                    '    </div>' +
                    '</div>'
                );
            }

            // --- NEW: SVG Icon Helper ---
            function getIconSvg(name) {
                const icons = {
                    link: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>',
                    twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>'
                };
                return icons[name] || icons['link'];
            }
        
            // ---------------------------------------------------------------------------
            // 4. ANILIST API (GRAPHQL) - MOVED TO anilist-queries.js
            // ---------------------------------------------------------------------------
            
            // ---------------------------------------------------------------------------
            // 5. NOVELBUDDY SCRAPERS (Matcher) - MOVED TO novelbuddy-scrapers.js
            // ---------------------------------------------------------------------------

            // ---------------------------------------------------------------------------
            // 6. NEW: STORAGE (localStorage)
            // ---------------------------------------------------------------------------
            
            /** Gets the storage key for a given Anilist ID */
            function getStorageKey(anilistId) {
                return \`novel_plugin_last_read_\${anilistId}\`;
            }

            /** Saves the last read chapter details to localStorage */
            function saveLastReadChapter(anilistId, chapterUrl, chapterTitle, chapterIndex) {
                try {
                    const data = {
                        chapterUrl,
                        chapterTitle,
                        chapterIndex: parseInt(chapterIndex, 10),
                        timestamp: Date.now()
                    };
                    localStorage.setItem(getStorageKey(anilistId), JSON.stringify(data));
                } catch (e) {
                    console.error("[novel-plugin] Error saving to localStorage", e);
                }
            }

            /** Loads the last read chapter details from localStorage */
            function getLastReadChapter(anilistId) {
                try {
                    const data = localStorage.getItem(getStorageKey(anilistId));
                    return data ? JSON.parse(data) : null;
                } catch (e) {
                    console.error("[novel-plugin] Error loading from localStorage", e);
                    return null;
                }
            }
            
            // ---------------------------------------------------------------------------
            // 7. NEW: READER LOGIC
            // ---------------------------------------------------------------------------
            
            /**
             * Central function to load a chapter, save progress, and open the reader.
             */
            async function loadAndReadChapter(chapterUrl, chapterIndex) {
                isLoading = true;
                pageState = "reader"; // Set page state *before* renderUI to show loader on correct page
                renderUI();
                
                try {
                    // --- CHANGED ---
                    const content = await NovelBuddyScrapers.getNovelBuddyChapterContent(chapterUrl);
                    const numericIndex = parseInt(chapterIndex, 10);
            
                    currentChapterContent = content;
                    currentChapterIndex = numericIndex;
            
                    // Save progress
                    if (currentNovel && currentNovelBuddyChapters[numericIndex]) {
                        const chapterTitle = currentNovelBuddyChapters[numericIndex].title;
                        saveLastReadChapter(currentNovel.id, chapterUrl, chapterTitle, numericIndex);
                    }
            
                    isLoading = false;
                    renderUI(); // Re-render now with the content
                    
                    // Scroll to top of content
                    const contentWrapper = document.getElementById(WRAPPER_ID);
                    if (contentWrapper) contentWrapper.scrollTop = 0;
                    
                } catch (err) {
                    console.error("[novel-plugin] Error loading chapter:", err);
                    isLoading = false;
                    pageState = "chapters"; // Go back to chapters list on error
                    renderUI();
                    // Maybe show a toast/error message here
                }
            }


            // ---------------------------------------------------------------------------
            // 8. UI RENDERING
            // ---------------------------------------------------------------------------
        
            function renderUI() {
                const wrapper = document.getElementById(WRAPPER_ID);
                if (!wrapper) return;
                
                // --- Back Button Logic ---
                // We need to know the page *before* clearing innerHTML
                const showBackButton = (pageState !== "discover" && pageState !== "search");
                
                wrapper.innerHTML = ""; // Clear content
                
                // Update active tab based on activeTabState
                document.querySelectorAll('.novel-plugin-tab').forEach(tab => tab.classList.remove('active'));
                document.getElementById(\`novel-plugin-tab-\${activeTabState}\`)?.classList.add('active');
                
                if (isLoading) {
                    wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                    return;
                }
                
                // --- Back Button ---
                if (showBackButton) {
                    const backBtn = document.createElement("button");
                    backBtn.className = "novel-plugin-back-btn";
                    backBtn.textContent = "‹ Back";
                    backBtn.onclick = () => {
                        console.log("[novel-plugin] Back button clicked. Current state:", pageState);
                        if (pageState === "reader") {
                            pageState = "chapters";
                        } else if (pageState === "chapters") {
                            pageState = "details";
                        } else if (pageState === "manual-match") {
                            pageState = "details";
                        } else if (pageState === "details") {
                            // Go back to the tab we started from
                            pageState = activeTabState;
                        }
                        console.log("[novel-plugin] New state:", pageState);
                        renderUI();
                    };
                    wrapper.appendChild(backBtn);
                }
                
                // --- Page Content Container ---
                const contentContainer = document.createElement("div");
                contentContainer.className = "novel-plugin-page-content";
                wrapper.appendChild(contentContainer);
                
                // --- Render Page ---
                if (pageState === "discover") renderDiscoverPage(contentContainer);
                if (pageState === "details") renderDetailsPage(contentContainer);
                if (pageState === "search") renderSearchPage(contentContainer);
                if (pageState === "manual-match") renderManualMatchPage(contentContainer);
                if (pageState === "chapters") renderChapterListPage(contentContainer);
                if (pageState === "reader") renderReaderPage(contentContainer);
            }
            
            // --- Page: Discover ---
            async function renderDiscoverPage(wrapper) {
                wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                // --- CHANGED ---
                const media = await AnilistQueries.getTrendingLightNovels();
                wrapper.innerHTML = ""; 
                
                if (!media || media.length === 0) {
                    wrapper.innerHTML = "<p>Could not load trending novels.</p>";
                    return;
                }
                
                const heroMedia = media[0];
                const bannerImg = heroMedia.bannerImage || heroMedia.coverImage.extraLarge;
                wrapper.innerHTML += \`
                    <div class="novel-plugin-hero" style="background-image: linear-gradient(to top, #121212 10%, rgba(18, 18, 18, 0)), url('\${bannerImg}')">
                        <div class="novel-plugin-hero-content">
                            <h1 class="novel-plugin-hero-title">\${heroMedia.title.romaji}</h1>
       
                             <p class="novel-plugin-hero-score">\${heroMedia.averageScore ?
                            heroMedia.averageScore + '%' : ''} Liked</p>
                            <button class="novel-plugin-button" data-id="\${heroMedia.id}">View Details</button>
                        </div>
                    </div>
                \`;
                wrapper.innerHTML += \`<h2 class="novel-plugin-section-title">Trending Novels</h2>\`;
                let gridHtml = '<div class="novel-plugin-grid">';
                media.forEach(item => {
                    gridHtml += \`
                        <div class="novel-plugin-poster-card" data-id="\${item.id}">
                            <img src="\${item.coverImage.large}" class="novel-plugin-poster-img" alt="\${item.title.romaji}" style="--cover-color: \${item.coverImage.color || '#8A2BE2'};">
               
                             <p class="novel-plugin-poster-title" title="\${item.title.romaji}">\${item.title.romaji}</p>
                        </div>
                    \`;
                });
                gridHtml += '</div>';
                wrapper.innerHTML += gridHtml;

                wrapper.querySelectorAll('.novel-plugin-poster-card, .novel-plugin-button').forEach(el => {
                    el.onclick = () => {
                        const id = el.getAttribute('data-id');
                        currentNovel = { id: id }; // Just set the ID for now
          
                        pageState = "details";
                        renderUI();
                    };
                });
            }

            // --- Page: Search (Sync) ---
            function renderSearchPage(wrapper) {
                // --- ADDED ---
                const genres = [
                    "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Hentai",
                    "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological",
                    "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
                ];
                // --- END ADDED ---

                wrapper.innerHTML += \`
                    <h1 class="novel-plugin-title">Search</h1>
                    <p class="novel-plugin-subtitle">Search for light novels from Anilist</p>
    
                    <div class="novel-plugin-input-container">
                        <input id="\${SEARCH_INPUT_ID}" class="novel-plugin-input" placeholder="e.g., Classroom of the Elite" />
                        <button id="novel-plugin-search-btn" class="novel-plugin-button">Search</button>
                    </div>

                    <!-- --- ADDED --- -->
                    <div class="novel-plugin-filter-container">
                        <select id="novel-plugin-sort-select" class="novel-plugin-select">
                            <option value="TRENDING_DESC">Sort by Trending</option>
                            <option value="POPULARITY_DESC">Sort by Popularity</option>
                            <option value="SCORE_DESC">Sort by Score</option>
                            <option value="SEARCH_MATCH">Sort by Relevancy</option>
                        </select>
                        <select id="novel-plugin-genre-select" class="novel-plugin-select">
                            <option value="">All Genres</option>
                            \${genres.map(g => \`<option value="\${g}">\${g}</option>\`).join('')}
                        </select>
                    </div>
                    <!-- --- END ADDED --- -->
     
                    <div id="novel-plugin-search-results" class="novel-plugin-grid">
                        <!-- Results will be injected here -->
                    </div>
                \`;
                const searchBtn = wrapper.querySelector("#novel-plugin-search-btn");
                const searchInput = wrapper.querySelector("#" + SEARCH_INPUT_ID);
                const resultsContainer = wrapper.querySelector("#novel-plugin-search-results");
                
                // --- ADDED ---
                const sortSelect = wrapper.querySelector("#novel-plugin-sort-select");
                const genreSelect = wrapper.querySelector("#novel-plugin-genre-select");
                // --- END ADDED ---

                async function performSearch(prefill = false) {
                    const query = searchInput.value;
                    // --- CHANGED ---
                    const sort = sortSelect.value;
                    const genre = genreSelect.value || null; // Send null if empty
                    
                    // --- CHANGED ---
                    // If it's a prefill (no query), and no genre is selected, just load trending
                    if (prefill && (!query || query.trim() === "") && !genre) {
                         resultsContainer.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                         const media = await AnilistQueries.getTrendingLightNovels();
                         renderSearchResults(media);
                         return;
                    }

                    // If user has typed, require a query
                    if (!prefill && (!query || query.trim() === "")) return;
                    // --- END CHANGED ---
                    
                    resultsContainer.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                    // --- CHANGED ---
                    const media = await AnilistQueries.searchAnilistLightNovels(query, sort, genre);
                    renderSearchResults(media);
                }
                
                function renderSearchResults(media) {
                     resultsContainer.innerHTML = "";
                    if (!media || media.length === 0) {
                        resultsContainer.innerHTML = "<p>No results found.</p>";
                        return;
                    }

                    let gridHtml = '';
                    media.forEach(item => {
                        gridHtml += \`
                            <div class="novel-plugin-poster-card" data-id="\${item.id}">
                                <img src="\${item.coverImage.large}" class="novel-plugin-poster-img" alt="\${item.title.romaji}" style="--cover-color: \${item.coverImage.color || '#8A2BE2'};">
   
                                 <p class="novel-plugin-poster-title" title="\${item.title.romaji}">\${item.title.romaji}</p>
                            </div>
                        \`;
                 
                    });
                    resultsContainer.innerHTML = gridHtml;
                    resultsContainer.querySelectorAll('.novel-plugin-poster-card').forEach(el => {
                        el.onclick = () => {
                            const id = el.getAttribute('data-id');
                            currentNovel = { id: id };
                            pageState = "details";
                            renderUI();
                        };
                
                    });
                }
                
                searchBtn.onclick = () => performSearch(false); // Button click is never a prefill
                searchInput.onkeyup = (e) => {
                    if (e.key === 'Enter') {
                        performSearch(false);
                    }
                };
                // --- ADDED ---
                sortSelect.onchange = () => performSearch(true); // Filter change respects prefill
                genreSelect.onchange = () => performSearch(true); // Filter change respects prefill
                
                // --- NEW ---
                performSearch(true); // Initial load
                // --- END NEW ---
            }
            
            // --- Page: Details (Async) ---
            // --- HEAVILY MODIFIED ---
            async function renderDetailsPage(wrapper) {
                if (!currentNovel || !currentNovel.id) {
                    console.error("No novel ID, returning to discover.");
                    pageState = "discover";
                    renderUI();
                    return;
                }
                
                wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                // --- CHANGED ---
                const media = await AnilistQueries.getAnilistLightNovelDetails(currentNovel.id);
                wrapper.innerHTML = ""; 
                
                if (!media) {
                    wrapper.innerHTML = "<p>Error loading details.</p>";
                    return;
                }
                
                currentNovel = media; // Store full media object
                
                // NEW: Get last read chapter
                const lastReadChapter = getLastReadChapter(currentNovel.id);
                
                // --- Spoiler State ---
                let showSpoilers = false;
                
                // --- Banner HTML (User's Request) ---
                const bannerImg = media.bannerImage || media.coverImage.extraLarge;
                // --- CHANGE: Added border-radius ---
                let bannerHtml = \`
                    <div style="
                        position: relative;
                        width: 100%;
                        min-height: 300px; /* User requested height */
                        overflow: hidden;
                        background-color: #121212; /* fallback */
                        box-shadow: inset 0 0 0 1px #121212; /* hides tiny side specs */
                        /* Copied from original CSS for layout */
                        margin: -1.5rem -1.5rem 0 -1.5rem;
                        max-width: 1000px;
                        box-sizing: content-box;
                        left: 50%;
                        transform: translateX(-50%);
                        margin-top: -4.5rem; /* BUG 1 FIX from original */
                        border-radius: 8px; /* --- ADDED --- */
                    ">
                        <div style="
                            position: absolute;
                            inset: 0; /* cover all sides */
                            background:
                                linear-gradient(to top, #121212 15%, rgba(18, 18, 18, 0)) no-repeat,
                                url('\${bannerImg}') center 10% / cover no-repeat;
                        "></div>
                    </div>
                \`;

                // --- Header HTML (Unchanged) ---
                let headerHtml = \`
                    <div class="novel-plugin-details-header">
                        <img src="\${media.coverImage.extraLarge}" class="novel-plugin-details-cover" style="--cover-color: \${media.coverImage.color || '#8A2BE2'};">
                        <div class="novel-plugin-details-info">
                            <h1 class="novel-plugin-title">\${media.title.romaji}</h1>
                            <p class="novel-plugin-subtitle">\${media.title.english || ''}</p>
                            <div class="novel-plugin-tags">
                                <span class="novel-plugin-tag score">\${media.averageScore ? media.averageScore + '%' : 'N/A'}</span>
                                <span class="novel-plugin-tag">\${media.status || ''}</span>
                                <span class="novel-plugin-tag">\${media.startDate.year || ''}</span>
                            </div>
                        </div>
                    </div>
                \`;
                
                // --- Body HTML (HEAVILY MODIFIED) ---
                
                // Helper to generate tag list
                function getTagsHtml(tags) {
                    if (!tags || tags.length === 0) return '<p class="novel-plugin-sidebar-muted">No tags available.</p>';
                    return tags.map(t => \`
                        <span 
                            class="novel-plugin-tag \${t.isMediaSpoiler ? 'novel-plugin-spoiler-tag' : ''}"
                            data-spoiler="\${t.isMediaSpoiler}"
                        >
                            \${t.name}
                        </span>
                    \`).join('');
                }
                
                // Helper to generate rankings
                function getRankingsHtml(rankings) {
                    if (!rankings || rankings.length === 0) return '<p class="novel-plugin-sidebar-muted">No rankings available.</p>';
                    // Filter for 'allTime' rankings and 'RATED' or 'POPULAR'
                    const ranked = rankings.filter(r => r.allTime && (r.type === 'RATED' || r.type === 'POPULAR'));
                    // --- FIX: Replaced single quotes around 'all time' with double quotes ---
                    if (ranked.length === 0) return '<p class="novel-plugin-sidebar-muted">No "all time" rankings available.</p>';
                    
                    return \`
                        <div class="novel-plugin-ranking-list">
                            \${ranked.map(r => \`
                                <div class="novel-plugin-ranking-item">
                                    <span class="novel-plugin-ranking-hash">#</span>
                                    <span class="novel-plugin-ranking-rank">\${r.rank}</span>
                                    \${r.context}
                                </div>
                            \`).join('')}
                        </div>
                    \`;
                }
                
                // Helper for external links
                function getLinksHtml(links) {
                    if (!links || links.length === 0) return '<p class="novel-plugin-sidebar-muted">No links available.</p>';
                    return \`
                        <div class="novel-plugin-external-links">
                            \${links.map(l => \`
                                <a href="\${l.url}" target="_blank" rel="noopener noreferrer" class="novel-plugin-ext-link-btn">
                                    <span class="novel-plugin-ext-icon">
                                        \${getIconSvg(l.site.toLowerCase().includes('twitter') ? 'twitter' : 'link')}
                                    </span>
                                    \${l.site}
                                </a>
                            \`).join('')}
                        </div>
                    \`;
                }
                
                // Helper for Character/Staff grids
                function getInvolvedGridHtml(edges, type) {
                    if (!edges || edges.length === 0) return '';
                    return \`
                        <h2 class="novel-plugin-section-title">\${type}</h2>
                        <div class="novel-plugin-involved-grid">
                            \${edges.map(edge => \`
                                <div class="novel-plugin-involved-card">
                                    <img src="\${edge.node.image.large}" class="novel-plugin-involved-img" loading="lazy">
                                    <div class="novel-plugin-involved-info">
                                        <div class="novel-plugin-involved-name">\${edge.node.name.full}</div>
                                        <div class="novel-plugin-involved-role">\${edge.role}</div>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    \`;
                }

                // Helper for Recommendations grid
                function getRecsGridHtml(recs) {
                    if (!recs || recs.length === 0) return '';
                    return \`
                        <h2 class="novel-plugin-section-title">Recommendations</h2>
                        <div class="novel-plugin-grid">
                            \${recs.map(r => {
                                const recMedia = r.mediaRecommendation;
                                if (!recMedia) return '';
                                return \`
                                <div class="novel-plugin-poster-card" data-id="\${recMedia.id}">
                                    <img src="\${recMedia.coverImage.large}" class="novel-plugin-poster-img" alt="\${recMedia.title.romaji}" style="--cover-color: \${recMedia.coverImage.color || '#8A2BE2'};">
                                    <p class="novel-plugin-poster-title" title="\${recMedia.title.romaji}">\${recMedia.title.romaji}</p>
                                </div>
                                \`;
                            }).join('')}
                        </div>
                    \`;
                }
                
                // Helper for Reviews
                function getReviewsHtml(reviews) {
                    if (!reviews || reviews.length === 0) return '';
                    const defaultAvatar = 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/default.png';
                    return \`
                        <h2 class="novel-plugin-section-title">Reviews</h2>
                        <div class="novel-plugin-reviews-list">
                            \${reviews.map(rev => \`
                                <div class="novel-plugin-review-card">
                                    <div class="novel-plugin-review-header">
                                        <img src="\${rev.user.avatar ? rev.user.avatar.large : defaultAvatar}" class="novel-plugin-review-avatar" />
                                        <div class="novel-plugin-review-meta">
                                            <span class="novel-plugin-review-user">\${rev.user.name}</span>
                                            <span class="novel-plugin-review-summary-text">\${rev.summary || 'No summary'}</span>
                                        </div>
                                        <div class="novel-plugin-review-score-badge">
                                            \${rev.score}
                                        </div>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    \`;
                }

                let bodyHtml = \`
                    <div class="novel-plugin-details-body">
                        <div class="novel-plugin-details-main">
                            <div class="novel-plugin-details-description">
                                <!-- --- CHANGE: Removed section header --- -->
                                <h3>About</h3>
                                <p id="novel-plugin-description-text">
                                    \${media.description ? media.description.replace(/<br>/g, ' ') : 'No description available.'}
                                </p>
                            </div>
                            
                            \${getInvolvedGridHtml(media.characters.edges, 'Characters')}
                            \${getInvolvedGridHtml(media.staff.edges, 'Staff')}
                            \${getRecsGridHtml(media.recommendations.nodes)}
                            \${getReviewsHtml(media.reviews.nodes)}
                        </div>
                        
                        <div class="novel-plugin-details-sidebar">
                            <div id="novel-plugin-chapter-button-container">
                                <!-- Buttons added dynamically -->
                            </div>
                            
                            <div class="novel-plugin-details-sidebar-section">
                                <h3>Rankings</h3>
                                \${getRankingsHtml(media.rankings)}
                            </div>
                            
                            <div class="novel-plugin-details-sidebar-section">
                                <h3>External Links</h3>
                                \${getLinksHtml(media.externalLinks)}
                            </div>

                            <div class="novel-plugin-details-sidebar-section">
                                <h3>Genres</h3>
                                <div class="novel-plugin-tags">
                                    \${media.genres.map(g => \`<span class="novel-plugin-tag">\${g}</span>\`).join('')}
                                </div>
                            </div>
                            
                            <!-- --- CHANGE: Added section header here --- -->
                            <div class="novel-plugin-details-sidebar-section">
                                <div class="novel-plugin-section-header">
                                    <h3>Tags</h3>
                                    <button id="novel-plugin-spoiler-toggle" class="novel-plugin-spoiler-toggle">Show Spoilers</button>
                                </div>
                                <div class="novel-plugin-tags" id="novel-plugin-tags-container">
                                    \${getTagsHtml(media.tags)}
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
                
                wrapper.innerHTML = bannerHtml + headerHtml + bodyHtml;
                
                // --- Logic for new elements ---
                
                // Spoiler Toggle
                const spoilerToggle = wrapper.querySelector('#novel-plugin-spoiler-toggle');
                const tagsContainer = wrapper.querySelector('#novel-plugin-tags-container');
                if (spoilerToggle && tagsContainer) {
                    spoilerToggle.onclick = () => {
                        showSpoilers = !showSpoilers;
                        tagsContainer.classList.toggle('show-spoilers', showSpoilers);
                        spoilerToggle.textContent = showSpoilers ? 'Hide Spoilers' : 'Show Spoilers';
                    };
                }
                
                // Recommendation Click Handlers
                // Use querySelectorAll on the wrapper to scope the search
                wrapper.querySelectorAll('.novel-plugin-poster-card[data-id]').forEach(el => {
                    const elId = el.getAttribute('data-id');
                    
                    // Check if this card is part of the recommendations grid
                    // This is a bit tricky, but we can check if its data-id is NOT the currentNovel.id
                    // Note: This might re-bind the main 'discover' cards if they are still in the DOM,
                    // but renderUI() clears the wrapper, so this should be fine.
                    
                    if (elId != currentNovel.id) { // Only bind clicks to *other* media
                         el.onclick = () => {
                            const id = el.getAttribute('data-id');
                            currentNovel = { id: id }; // Just set the ID for now
                            pageState = "details";
                            renderUI();
                        };
                    }
                });
                
                
                // --- Original Chapter Button Logic ---
                const chapterBtnContainer = wrapper.querySelector('#novel-plugin-chapter-button-container');
                
                // 1. Create a container for the auto-match results (loader first)
                const autoMatchContainer = document.createElement('div');
                autoMatchContainer.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;
                chapterBtnContainer.appendChild(autoMatchContainer);

                // 2. Add Manual Search Button
                const manualSearchBtn = document.createElement('button');
                manualSearchBtn.className = 'novel-plugin-button secondary';
                manualSearchBtn.id = 'novel-plugin-manual-match-btn';
                manualSearchBtn.textContent = 'Manual Search';
                manualSearchBtn.onclick = () => {
                    pageState = "manual-match";
                    renderUI();
                };
                chapterBtnContainer.appendChild(manualSearchBtn);
                
                // 3. Asynchronously find chapters and update auto-match container
                // --- CHANGED ---
                const chapters = await NovelBuddyScrapers.findNovelBuddyChapters(media.title.romaji, media.title.english);
                if (chapters && chapters.length > 0) {
                    currentNovelBuddyChapters = chapters;
                    
                    // --- NEW "Read Now" / "Continue" Button ---
                    let readNowHtml = '';
                    if (lastReadChapter && lastReadChapter.chapterUrl) {
                        // Found last read chapter
                        readNowHtml = \`
                            <button class="novel-plugin-button" id="novel-plugin-continue-btn">
                                Continue: \${lastReadChapter.chapterTitle}
                            </button>
                        \`;
                    } else {
                        // No last read chapter, show "Start Reading"
                        readNowHtml = \`
                            <button class="novel-plugin-button" id="novel-plugin-start-btn">
                                Start Reading (Ch 1)
                            </button>
                        \`;
                    }
                    
                    autoMatchContainer.innerHTML = \`
                        \${readNowHtml}
                        <button class="novel-plugin-button secondary" id="novel-plugin-view-all-btn">
                            View All Chapters (\${chapters.length})
                        </button>
                    \`;
                    
                    // Add click handlers
                    const continueBtn = autoMatchContainer.querySelector('#novel-plugin-continue-btn');
                    if (continueBtn) {
                        continueBtn.onclick = () => {
                            loadAndReadChapter(lastReadChapter.chapterUrl, lastReadChapter.chapterIndex);
                        };
                    }
                    
                    const startBtn = autoMatchContainer.querySelector('#novel-plugin-start-btn');
                    if (startBtn) {
                        startBtn.onclick = () => {
                            loadAndReadChapter(chapters[0].url, 0); // Load first chapter
                        };
                    }
                    
                    autoMatchContainer.querySelector('#novel-plugin-view-all-btn').onclick = () => {
                        pageState = "chapters";
                        renderUI();
                    };
                    
                } else {
                    autoMatchContainer.innerHTML = \`<p class="novel-plugin-error-text">No automatic match found.</p>\`;
                }
            }
            
            // --- Page: Manual Match ---
            function renderManualMatchPage(wrapper) {
                if (!currentNovel) { pageState = "discover";
                renderUI(); return; }
                
                const prefill = currentNovel.title.romaji ||
                '';
                wrapper.innerHTML += \`
                    <h1 class="novel-plugin-title">Manual Match</h1>
                    <p class="novel-plugin-subtitle">Search NovelBuddy for "\${currentNovel.title.romaji}"</p>
                    <div class="novel-plugin-input-container">
                        <input id="\${SEARCH_INPUT_ID}" class="novel-plugin-input" value="\${prefill.replace(/"/g, '&quot;')}"/>
  
                        <button id="novel-plugin-manual-search-btn" class="novel-plugin-button">Search</button>
                    </div>
                    <div id="novel-plugin-manual-results" class="novel-plugin-manual-list">
                        <!-- Results will be injected here -->
    
                    </div>
                \`;
                const searchBtn = wrapper.querySelector("#novel-plugin-manual-search-btn");
                const searchInput = wrapper.querySelector("#" + SEARCH_INPUT_ID);
                const resultsContainer = wrapper.querySelector("#novel-plugin-manual-results");
                
                async function performManualSearch() {
                    const query = searchInput.value;
                    if (!query || query.trim() === "") return;
                    
                    resultsContainer.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;
                    // --- CHANGED ---
                    const results = await NovelBuddyScrapers.searchNovelBuddy(query);
                    resultsContainer.innerHTML = "";
                    if (results.length === 0) {
                        resultsContainer.innerHTML = "<p>No results found on NovelBuddy.</p>";
                        return;
                    }
                    
                    results.forEach(item => {
                        const itemEl = document.createElement('div');
                        
                        itemEl.className = 'novel-plugin-result-card';
                        itemEl.innerHTML = \`
                            <img 
                                src="\${item.image || 'https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'}" 
                                 class="novel-plugin-result-img"
                                referrerpolicy="no-referrer"
                                 onerror="this.src='https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'"
                            >
                            <div class="novel-plugin-result-stack">
                                <p class="novel-plugin-result-title" title="\${item.title}">\${item.title}</p>
                                 <p class="novel-plugin-result-chapter">\${item.latestChapter ||
                                'Unknown'}</p>
                            </div>
                            <button class="novel-plugin-view-btn select-btn" data-url="\${item.url}">Select</button>
                        \`;
                        itemEl.querySelector('.select-btn').onclick = async (e) => {
                            const url = e.currentTarget.getAttribute("data-url");
                            isLoading = true; 
                            renderUI();
                            
                            // --- CHANGED ---
                            const chapters = await NovelBuddyScrapers.getNovelBuddyDetails(url);
                            currentNovelBuddyChapters = chapters; // Set the chapters
                            
                            isLoading = false;
                            if (chapters.length === 0) {
                                pageState = "manual-match";
                                renderUI();
                            } else {
                                pageState = "chapters"; // Go to chapter list
                                renderUI();
                            }
                        };
                        resultsContainer.appendChild(itemEl);
                    });
                }

                searchBtn.onclick = performManualSearch;
                searchInput.onkeyup = (e) => {
                    if (e.key === 'Enter') {
                        performManualSearch();
                    }
                };
                // Perform an initial search immediately
                performManualSearch();
            }

            // --- Page: Chapters (Sync) ---
            function renderChapterListPage(wrapper) {
                if (!currentNovel) { pageState = "discover";
                renderUI(); return; }
                let chaptersHtml = \`
                    <h2 class="novel-plugin-title">\${currentNovel.title.romaji}</h2>
                    <p class="novel-plugin-subtitle">Chapters</p>
                    <div class="novel-plugin-chapter-list">
                
                \`;
                
                if (currentNovelBuddyChapters.length === 0) {
                     chaptersHtml += "<p>No chapters found.</p>";
                } else {
                    // NEW: Get last read chapter to highlight it
                    const lastReadChapter = getLastReadChapter(currentNovel.id);
                    
                    currentNovelBuddyChapters.forEach((chapter, index) => {
                        const isLastRead = lastReadChapter && lastReadChapter.chapterIndex === index;
                        chaptersHtml += \`
                            <div class="novel-plugin-chapter-item \${isLastRead ? 'last-read' : ''}">
                               <p class="novel-plugin-chapter-title" title="\${chapter.title}">
                                   \${isLastRead ? '<span>★</span>' : ''} \${chapter.title}
                               </p>
                                <button class="novel-plugin-view-btn read-btn" data-url="\${chapter.url}" data-index="\${index}">Read</button>
                            </div>
                        \`;
                    });
                }
                chaptersHtml += '</div>';
                wrapper.innerHTML += chaptersHtml;
                
                // NEW: Attach click handler to load chapter
                wrapper.querySelectorAll(".read-btn").forEach(btn => {
                    btn.onclick = (e) => {
                        const url = e.currentTarget.getAttribute("data-url");
                        const index = e.currentTarget.getAttribute("data-index");
                        loadAndReadChapter(url, index);
                    };
                });
            }
            
            function renderReaderPage(wrapper) {
                if (!currentNovel || currentChapterContent === null) {
                    pageState = "chapters";
                    renderUI();
                    return;
                }
                
                // --- Reader Navigation Header ---
                const readerHeader = document.createElement('div');
                readerHeader.className = 'novel-plugin-reader-header';
                
                // Prev Button
                const prevBtn = document.createElement('button');
                prevBtn.className = 'novel-plugin-button';
                prevBtn.textContent = '‹ Prev';
                prevBtn.disabled = currentChapterIndex <= 0;
                prevBtn.onclick = () => {
                    if (currentChapterIndex > 0) {
                        const newIndex = currentChapterIndex - 1;
                        loadAndReadChapter(currentNovelBuddyChapters[newIndex].url, newIndex);
                    }
                };
                
                // Next Button
                const nextBtn = document.createElement('button');
                nextBtn.className = 'novel-plugin-button';
                nextBtn.textContent = 'Next ›';
                nextBtn.disabled = currentChapterIndex >= currentNovelBuddyChapters.length - 1;
                nextBtn.onclick = () => {
                    if (currentChapterIndex < currentNovelBuddyChapters.length - 1) {
                        const newIndex = currentChapterIndex + 1;
                        loadAndReadChapter(currentNovelBuddyChapters[newIndex].url, newIndex);
                    }
                };
                
                // Chapter Select
                const chapterSelect = document.createElement('select');
                chapterSelect.className = 'novel-plugin-select';
                currentNovelBuddyChapters.forEach((chapter, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = chapter.title;
                    if (index === currentChapterIndex) {
                        option.selected = true;
                    }
                    chapterSelect.appendChild(option);
                });
                chapterSelect.onchange = (e) => {
                    // FIX: Parse value to integer for correct comparison and indexing
                    const newIndex = parseInt(e.target.value, 10);
                    if (newIndex !== currentChapterIndex) {
                        loadAndReadChapter(currentNovelBuddyChapters[newIndex].url, newIndex);
                    }
                };
                
                readerHeader.appendChild(prevBtn);
                readerHeader.appendChild(chapterSelect);
                readerHeader.appendChild(nextBtn);
                wrapper.appendChild(readerHeader); // Add the header
                // --- END: Reader Navigation Header ---
                
                
                const readerContainer = document.createElement('div');
                readerContainer.className = 'novel-plugin-reader-container';
                
                const readerContent = document.createElement('div');
                readerContent.className = 'novel-plugin-reader-content';
                readerContent.innerHTML = currentChapterContent; // Set innerHTML here
                
                readerContainer.appendChild(readerContent);
                wrapper.appendChild(readerContainer); // Add the content
            }
        
            // ---------------------------------------------------------------------------
            // 9. MODAL LIFECYCLE
            // ---------------------------------------------------------------------------
        
            async function openNovelPage() {
                if (mainLayout) mainLayout.style.display = "none";
                const loadCss = new Promise(async (resolve, reject) => {
                    const cssUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/styles.css";
                    
                    try {
                        console.log(\`[novel-plugin] Attempting to fetch CSS from: \${cssUrl}\`);
                        const res = await fetch(cssUrl);
                        if (!res.ok) throw new Error(\`Fetch failed: \${res.status}\`);
                        const cssText = await res.text();
            
                        const style = document.createElement("style");
                        style.id = STYLE_ID;
                        style.textContent = cssText;
                        
                        // --- FIX: Add new CSS rules for reader header layout ---
                        style.textContent += \`
                            .novel-plugin-reader-header { 
                                display: flex; 
                                gap: 8px; 
                                align-items: center; 
                            }
                            .novel-plugin-reader-header .novel-plugin-select { 
                                flex-grow: 1; 
                            }
                            /* --- NEW FIX: Fix back button --- */
                            .novel-plugin-back-btn {
                                width: auto;
                                height: auto;
                                padding: 4px 12px;
                                border-radius: 9999px;
                            }
                        \`;
                        // --- END FIX ---
                        
                        document.head.appendChild(style);
         
                        console.log("[novel-plugin] External CSS fetched and injected.");
                        resolve();
                    } catch (err) {
                        console.error("[novel-plugin] FAILED to fetch or inject CSS:", err);
                        reject(err);
                    }
                });

                // --- ADDED THIS BLOCK ---
                const loadQueries = new Promise(async (resolve, reject) => {
                    // !!! IMPORTANT: You must host this file and update the URL !!!
                    const jsUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/anilist.js"; 
                    
                    try {
                        console.log(\`[novel-plugin] Attempting to fetch JS from: \${jsUrl}\`);
                        const res = await fetch(jsUrl);
                        if (!res.ok) throw new Error(\`Fetch failed: \${res.status}\`);
                        const jsText = await res.text();
            
                        const script = document.createElement("script");
                        script.id = SCRIPT_QUERY_ID;
                        script.textContent = jsText;
                        document.head.appendChild(script);
         
                        console.log("[novel-plugin] External JS (Queries) fetched and injected.");
                        resolve();
                    } catch (err) {
                        console.error("[novel-plugin] FAILED to fetch or inject JS (Queries):", err);
                        reject(err);
                    }
                });

                const loadScrapers = new Promise(async (resolve, reject) => {
                    // !!! IMPORTANT: You must host this file and update the URL !!!
                    const jsUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/novelbuddy.js"; 
                    
                    try {
                        console.log(\`[novel-plugin] Attempting to fetch JS from: \${jsUrl}\`);
                        const res = await fetch(jsUrl);
                        if (!res.ok) throw new Error(\`Fetch failed: \${res.status}\`);
                        const jsText = await res.text();
            
                        const script = document.createElement("script");
                        script.id = SCRIPT_SCRAPER_ID;
                        script.textContent = jsText;
                        document.head.appendChild(script);
         
                        console.log("[novel-plugin] External JS (Scrapers) fetched and injected.");
                        resolve();
                    } catch (err) {
                        console.error("[novel-plugin] FAILED to fetch or inject JS (Scrapers):", err);
                        reject(err);
                    }
                });
                // --- END ADDED BLOCK ---

                try {
                    await loadCss;
                    await loadQueries; // <-- ADDED AWAIT
                    await loadScrapers; // <-- ADDED AWAIT
                    
                    const backdrop = document.createElement("div");
                    backdrop.id = BACKDROP_ID;
                    backdrop.innerHTML = getModalHtml();
                    document.body.appendChild(backdrop);
                    
                    document.getElementById('novel-plugin-tab-discover').onclick = () => {
                        activeTabState = "discover";
                        pageState = "discover";
                        renderUI();
                    };
                    document.getElementById('novel-plugin-tab-search').onclick = () => {
                        activeTabState = "search";
                        pageState = "search";
                        renderUI();
                    };
                    document.getElementById(CLOSE_BTN_ID).onclick = closeNovelPage;
                    
                    renderUI(); // Initial render
                } catch (err) {
                    console.error("[novel-plugin] Could not start modal.", err.message, err.stack);
                    closeNovelPage(); 
                }
            }
            
            function closeNovelPage() {
                if (mainLayout) mainLayout.style.display = "flex";
                const backdrop = document.getElementById(BACKDROP_ID);
                if (backdrop) backdrop.remove();
                const style = document.getElementById(STYLE_ID);
                if (style) style.remove();
                
                // --- ADDED THIS BLOCK ---
                const queries = document.getElementById(SCRIPT_QUERY_ID);
                if (queries) queries.remove();
                const scrapers = document.getElementById(SCRIPT_SCRAPER_ID);
                if (scrapers) scrapers.remove();
                // --- END ADDED BLOCK ---

                const self = document.querySelector(\`script[data-novel-plugin-id="\${SCRIPT_ID}"]\`);
                if (self) self.remove();
                console.log("[novel-plugin] Cleaned up and removed.");
            }
            
            // ---------------------------------------------------------------------------
            // 10. START PLUGIN
            // ---------------------------------------------------------------------------
            await openNovelPage();
        })();
            `;
        }

        // 2. Create the Tray Icon
        const tray = ctx.newTray({
            tooltipText: "Novel Reader",
            iconUrl: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/public/ln.png",
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
                script.setText(getInjectedScriptString(scriptId));
                body.append(script);
                console.log(`[novel-plugin] Injected script tag #${scriptId}`);

            } catch (err) {
                console.error("[novel-plugin] FATAL ERROR in tray.onClick():", err);
            }
        }); // End of tray.onClick
    }); // End of $ui.register
}

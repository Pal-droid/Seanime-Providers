/// <reference path="./core.d.ts" />

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
            
            // DOM IDs
            const STYLE_ID = "novel-plugin-styles";
            const SCRIPT_QUERY_ID = "novel-plugin-queries";
            const SCRIPT_SCRAPER_ID_NOVELBUDDY = "novel-plugin-scrapers-novelbuddy";
            const SCRIPT_SCRAPER_ID_NOVELBIN = "novel-plugin-scrapers-novelbin"; // NEW
            const BACKDROP_ID = "novel-plugin-backdrop";
            const MODAL_ID = "novel-plugin-modal-content";
            const WRAPPER_ID = "novel-plugin-content-wrapper";
            const CLOSE_BTN_ID = "novel-plugin-btn-close";
            const SEARCH_INPUT_ID = "novel-plugin-search-input";
            const APP_LAYOUT_SELECTOR = ".UI-AppLayout__root";

            // --- Centralized constants ---
            const GENRES = [
                "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Hentai",
                "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological",
                "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
            ];
            const DEFAULT_ANILIST_AVATAR = 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/default.png';

            // --- NEW: Source Management ---
            const sourceRegistry = new Map();
            window.novelPluginRegistry = {
                registerSource: (source) => {
                    console.log(\`[novel-plugin] Registered source: \${source.name}\`);
                    sourceRegistry.set(source.id, source);
                }
            };
        
            // ---------------------------------------------------------------------------
            // 2. PLUGIN STATE
            // ---------------------------------------------------------------------------
            let pageState = "discover";
            let activeTabState = "discover";
            let isLoading = false;
            let currentNovel = null; // Holds full Anilist media object
            let currentChapterContent = null;
            
            // --- NEW: Multi-Source State ---
            let currentNovelSourceId = null; // e.g., "novelbuddy"
            let currentNovelChapters = []; // Chapters for the *active* source
            let allAvailableMatches = new Map(); // Stores all valid matches, e.g., { "novelbuddy": { match, similarity } }
            
            const mainLayout = document.querySelector(APP_LAYOUT_SELECTOR);
            // ---------------------------------------------------------------------------
            // 3. STYLES & HTML (Injected)
            // ---------------------------------------------------------------------------
            
            function getModalHtml() {
                return (
                    '<div id="' + MODAL_ID + '">' +
                    '    <button id="' + CLOSE_BTN_ID + '"></button>' +
                    '    <div class="novel-plugin-header">' +
                    '       <div class="novel-plugin-tabs">' +
                    '           <button class="novel-plugin-tab" id="novel-plugin-tab-discover" data-page="discover">Discover</button>' +
                    '           <button class="novel-plugin-tab" id="novel-plugin-tab-search" data-page="search">Search</button>' +
                    '       </div>' +
                    '    </div>' +
                    '    <div id="' + WRAPPER_ID + '"></div>' +
                    '</div>'
                );
            }

            // --- SVG Icon Helper ---
            function getIconSvg(name) {
                const icons = {
                    link: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>',
                    twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>'
                };
                return icons[name] || icons['link'];
            }
        
            // ---------------------------------------------------------------------------
            // 4. STORAGE (localStorage)
            // ---------------------------------------------------------------------------
            
            /** Gets the storage key for a given Anilist ID AND source ID */
            function getStorageKey(anilistId, sourceId) {
                // Return a combined key if sourceId is provided
                if (anilistId && sourceId) {
                    return \`novel_plugin_last_read_\${anilistId}_\${sourceId}\`;
                }
                // Fallback for old keys (or if sourceId is null)
                return \`novel_plugin_last_read_\${anilistId}\`;
            }

            /** Saves the last read chapter details to localStorage */
            function saveLastReadChapter(anilistId, sourceId, chapterUrl, chapterTitle, chapterIndex) {
                if (!anilistId || !sourceId) return;
                try {
                    const data = {
                        chapterUrl,
                        chapterTitle,
                        chapterIndex: parseInt(chapterIndex, 10),
                        timestamp: Date.now()
                    };
                    localStorage.setItem(getStorageKey(anilistId, sourceId), JSON.stringify(data));
                } catch (e) {
                    console.error("[novel-plugin] Error saving to localStorage", e);
                }
            }

            /** Loads the last read chapter details from localStorage */
            function getLastReadChapter(anilistId, sourceId) {
                if (!anilistId || !sourceId) return null;
                try {
                    // First try the new key
                    let data = localStorage.getItem(getStorageKey(anilistId, sourceId));
                    if (data) {
                        return JSON.parse(data);
                    }
                    
                    // --- MIGRATION: Try to load from old key ---
                    data = localStorage.getItem(getStorageKey(anilistId, null));
                    if (data) {
                        console.log(\`[novel-plugin] Migrating old save data for novel \${anilistId}\`);
                        // Save it to the new key format and remove the old one
                        const parsedData = JSON.parse(data);
                        saveLastReadChapter(anilistId, sourceId, parsedData.chapterUrl, parsedData.chapterTitle, parsedData.chapterIndex);
                        localStorage.removeItem(getStorageKey(anilistId, null)); // Remove old key
                        return parsedData;
                    }
                    
                    return null; // No save data found
                } catch (e) {
                    console.error("[novel-plugin] Error loading from localStorage", e);
                    return null;
                }
            }
            
            // ---------------------------------------------------------------------------
            // 5. READER LOGIC (Controller)
            // ---------------------------------------------------------------------------
            
            /**
             * Central function to load a chapter, save progress, and open the reader.
             */
            async function loadAndReadChapter(chapterUrl, chapterIndex) {
                const source = sourceRegistry.get(currentNovelSourceId);
                if (!source) {
                    console.error("No active source to load chapter content!");
                    return;
                }

                isLoading = true;
                pageState = "reader";
                renderUI();
                
                try {
                    const content = await source.getChapterContent(chapterUrl);
                    const numericIndex = parseInt(chapterIndex, 10);
            
                    currentChapterContent = content;
                    currentChapterIndex = numericIndex;
            
                    // Save progress
                    if (currentNovel && currentNovelChapters[numericIndex]) {
                        const chapterTitle = currentNovelChapters[numericIndex].title;
                        saveLastReadChapter(currentNovel.id, currentNovelSourceId, chapterUrl, chapterTitle, numericIndex);
                    }
            
                    isLoading = false;
                    renderUI(); // Re-render now with the content
                    
                    const contentWrapper = document.getElementById(WRAPPER_ID);
                    if (contentWrapper) contentWrapper.scrollTop = 0;
                    
                } catch (err) {
                    console.error("[novel-plugin] Error loading chapter:", err);
                    isLoading = false;
                    pageState = "chapters"; 
                    renderUI();
                }
            }

            // --- Function to load chapters for the active source ---
            async function loadChaptersForActiveSource() {
                const source = sourceRegistry.get(currentNovelSourceId);
                const matchData = allAvailableMatches.get(currentNovelSourceId);
                
                if (!source || !matchData) {
                    console.error("Cannot load chapters: No valid source or match selected.");
                    currentNovelChapters = []; // Ensure chapters are cleared
                    return [];
                }

                // Check if chapters are already fetched for this source
                if (matchData.chapters) {
                    currentNovelChapters = matchData.chapters; // Update state
                    return matchData.chapters;
                }
                
                // Fetch chapters if not already cached
                console.log(\`[novel-plugin] Fetching chapters for source: \${source.name}\`);
                const chapters = await source.getChapters(matchData.match.url);
                allAvailableMatches.get(currentNovelSourceId).chapters = chapters; // Cache them
                currentNovelChapters = chapters; // Update state
                return chapters;
            }


            // ---------------------------------------------------------------------------
            // 6. UI RENDERING (Views)
            // ---------------------------------------------------------------------------
        
            /** Main UI router */
            function renderUI() {
                const wrapper = document.getElementById(WRAPPER_ID);
                if (!wrapper) return;
                
                const showBackButton = (pageState !== "discover" && pageState !== "search");
                
                wrapper.innerHTML = ""; // Clear content
                
                // Update active tab based on activeTabState
                document.querySelectorAll('.novel-plugin-tab').forEach(tab => tab.classList.remove('active'));
                document.getElementById(\`novel-plugin-tab-\${activeTabState}\`)?.classList.add('active');
                
                if (isLoading) {
                    wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                    return;
                }
                
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
                            pageState = activeTabState;
                        }
                        console.log("[novel-plugin] New state:", pageState);
                        renderUI();
                    };
                    wrapper.appendChild(backBtn);
                }
                
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
                        currentNovel = { id: id };
                        // NEW: Reset states
                        currentNovelSourceId = null;
                        currentNovelChapters = [];
                        allAvailableMatches.clear();
                        pageState = "details";
                        renderUI();
                    };
                });
            }

            // --- Page: Search ---
            function renderSearchPage(wrapper) {
                wrapper.innerHTML += \`
                    <h1 class="novel-plugin-title">Search</h1>
                    <p class="novel-plugin-subtitle">Search for light novels from Anilist</p>
    
                    <div class="novel-plugin-input-container">
                        <input id="\${SEARCH_INPUT_ID}" class="novel-plugin-input" placeholder="e.g., Classroom of the Elite" />
                        <button id="novel-plugin-search-btn" class="novel-plugin-button">Search</button>
                    </div>

                    <div class="novel-plugin-filter-container">
                        <select id="novel-plugin-sort-select" class="novel-plugin-select">
                            <option value="TRENDING_DESC">Sort by Trending</option>
                            <option value="POPULARITY_DESC">Sort by Popularity</option>
                            <option value="SCORE_DESC">Sort by Score</option>
                            <option value="SEARCH_MATCH">Sort by Relevancy</option>
                        </select>
                        <select id="novel-plugin-genre-select" class="novel-plugin-select">
                            <option value="">All Genres</option>
                            \${GENRES.map(g => \`<option value="\${g}">\${g}</option>\`).join('')}
                        </select>
                    </div>
     
                    <div id="novel-plugin-search-results" class="novel-plugin-grid">
                        <!-- Results will be injected here -->
                    </div>
                \`;
                const searchBtn = wrapper.querySelector("#novel-plugin-search-btn");
                const searchInput = wrapper.querySelector("#" + SEARCH_INPUT_ID);
                const resultsContainer = wrapper.querySelector("#novel-plugin-search-results");
                const sortSelect = wrapper.querySelector("#novel-plugin-sort-select");
                const genreSelect = wrapper.querySelector("#novel-plugin-genre-select");

                async function performSearch(prefill = false) {
                    const query = searchInput.value;
                    const sort = sortSelect.value;
                    const genre = genreSelect.value || null; 
                    
                    if (prefill && (!query || query.trim() === "") && !genre) {
                         resultsContainer.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                         const media = await AnilistQueries.getTrendingLightNovels();
                         renderSearchResults(media);
                         return;
                    }

                    if (!prefill && (!query || query.trim() === "")) return;
                    
                    resultsContainer.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
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
                            // NEW: Reset states
                            currentNovelSourceId = null;
                            currentNovelChapters = [];
                            allAvailableMatches.clear();
                            pageState = "details";
                            renderUI();
                        };
                
                    });
                }
                
                searchBtn.onclick = () => performSearch(false);
                searchInput.onkeyup = (e) => {
                    if (e.key === 'Enter') {
                        performSearch(false);
                    }
                };
                sortSelect.onchange = () => performSearch(true); 
                genreSelect.onchange = () => performSearch(true); 
                
                performSearch(true); // Initial load
            }
            
            // --- Page: Details ---
            async function renderDetailsPage(wrapper) {
                if (!currentNovel || !currentNovel.id) {
                    console.error("No novel ID, returning to discover.");
                    pageState = "discover";
                    renderUI();
                    return;
                }
                
                wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                const media = await AnilistQueries.getAnilistLightNovelDetails(currentNovel.id);
                wrapper.innerHTML = ""; 
                
                if (!media) {
                    wrapper.innerHTML = "<p>Error loading details.</p>";
                    return;
                }
                
                currentNovel = media; 
                let lastReadChapter = null;
                let showSpoilers = false;
                
                // --- Banner HTML ---
                const bannerImg = media.bannerImage || media.coverImage.extraLarge;
                let bannerHtml = \`
                    <div style="
                        position: relative;
                        width: 100%;
                        min-height: 300px;
                        overflow: hidden;
                        background-color: #121212;
                        box-shadow: inset 0 0 0 1px #121212;
                        margin: -1.5rem -1.5rem 0 -1.5rem;
                        max-width: 1000px;
                        box-sizing: content-box;
                        left: 55%;
                        transform: translateX(-50%);
                        margin-top: -4.5rem;
                        border-radius: 8px;
                    ">
                        <div style="
                            position: absolute;
                            inset: 0;
                            background:
                                linear-gradient(to top, #121212 15%, rgba(18, 18, 18, 0)) no-repeat,
                                url('\${bannerImg}') center 10% / cover no-repeat;
                        "></div>
                    </div>
                \`;

                // --- Header HTML ---
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
                
                // --- Body HTML (with inner helpers) ---
                
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
                
                function getRankingsHtml(rankings) {
                    if (!rankings || rankings.length === 0) return '<p class="novel-plugin-sidebar-muted">No rankings available.</p>';
                    const ranked = rankings.filter(r => r.allTime && (r.type === 'RATED' || r.type === 'POPULAR'));
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
                
                function getReviewsHtml(reviews) {
                    if (!reviews || reviews.length === 0) return '';
                    return \`
                        <h2 class="novel-plugin-section-title">Reviews</h2>
                        <div class="novel-plugin-reviews-list">
                            \${reviews.map(rev => \`
                                <div class="novel-plugin-review-card">
                                    <div class="novel-plugin-review-header">
                                        <img src="\${rev.user.avatar ? rev.user.avatar.large : DEFAULT_ANILIST_AVATAR}" class="novel-plugin-review-avatar" />
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
                
                // --- Event Handlers & Async Logic ---
                
                const spoilerToggle = wrapper.querySelector('#novel-plugin-spoiler-toggle');
                const tagsContainer = wrapper.querySelector('#novel-plugin-tags-container');
                if (spoilerToggle && tagsContainer) {
                    spoilerToggle.onclick = () => {
                        showSpoilers = !showSpoilers;
                        tagsContainer.classList.toggle('show-spoilers', showSpoilers);
                        spoilerToggle.textContent = showSpoilers ? 'Hide Spoilers' : 'Show Spoilers';
                    };
                }
                
                wrapper.querySelectorAll('.novel-plugin-poster-card[data-id]').forEach(el => {
                    const elId = el.getAttribute('data-id');
                    if (elId != currentNovel.id) {
                         el.onclick = () => {
                            const id = el.getAttribute('data-id');
                            currentNovel = { id: id }; 
                            // NEW: Reset states
                            currentNovelSourceId = null;
                            currentNovelChapters = [];
                            allAvailableMatches.clear();
                            pageState = "details";
                            renderUI();
                        };
                    }
                });
                
                const chapterBtnContainer = wrapper.querySelector('#novel-plugin-chapter-button-container');
                const autoMatchContainer = document.createElement('div');
                autoMatchContainer.id = "novel-plugin-auto-match-container";
                autoMatchContainer.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;
                chapterBtnContainer.appendChild(autoMatchContainer);

                // --- Multi-Provider Auto-Match ---
                
                // 1. Run autoMatch for all registered sources in parallel
                const matchPromises = [];
                sourceRegistry.forEach(source => {
                    matchPromises.push(source.autoMatch(media.title.romaji, media.title.english));
                });

                const allResults = await Promise.allSettled(matchPromises);
                
                // 2. Find the best match
                let bestMatch = null;
                allAvailableMatches.clear();
                
                allResults.forEach((result, index) => {
                    const sourceId = [...sourceRegistry.keys()][index];
                    // Check if the promise was successful AND returned a result
                    if (result.status === 'fulfilled' && result.value) {
                        allAvailableMatches.set(sourceId, { ...result.value, chapters: null }); // Store match, reset chapters
                        
                        if (!bestMatch || result.value.similarity > bestMatch.similarity) {
                            bestMatch = { ...result.value, sourceId: sourceId };
                        }
                    } else if (result.status === 'rejected') {
                        console.error(\`[novel-plugin] Source '\${sourceId}' failed to match:\`, result.reason);
                    }
                });
                
                // 3. Render the result
                if (bestMatch) {
                    console.log(\`[novel-plugin] Auto-match selected: "\${bestMatch.sourceId}" with score \${bestMatch.similarity.toFixed(2)}\`);
                    currentNovelSourceId = bestMatch.sourceId; // Set the active source
                    
                    // Now, asynchronously load chapters for this best match
                    loadChaptersForActiveSource().then(chapters => {
                        // Re-validate last read chapter
                        lastReadChapter = getLastReadChapter(currentNovel.id, currentNovelSourceId);
                        if (lastReadChapter && chapters.length > 0) {
                            const savedIndex = lastReadChapter.chapterIndex;
                            const savedTitle = lastReadChapter.chapterTitle;
                            if (savedIndex >= chapters.length || chapters[savedIndex].title !== savedTitle) {
                                console.warn(\`[novel-plugin] Stale chapter data for \${currentNovelSourceId}. Clearing.\`);
                                localStorage.removeItem(getStorageKey(currentNovel.id, currentNovelSourceId)); 
                                lastReadChapter = null; 
                            }
                        }
                        // Now render the buttons
                        renderChapterButtons(autoMatchContainer);
                    });
                    
                } else {
                    autoMatchContainer.innerHTML = \`<p class="novel-plugin-error-text">No automatic match found on any provider.</p>\`;
                }

                // Add Manual Search Button
                const manualSearchBtn = document.createElement('button');
                manualSearchBtn.className = 'novel-plugin-button secondary';
                manualSearchBtn.id = 'novel-plugin-manual-match-btn';
                manualSearchBtn.textContent = 'Manual Search';
                manualSearchBtn.onclick = () => {
                    pageState = "manual-match";
                    renderUI();
                };
                chapterBtnContainer.appendChild(manualSearchBtn);
            }
            
            /** Helper to render chapter buttons (called after match) */
            function renderChapterButtons(container) {
                let readNowHtml = '';
                lastReadChapter = getLastReadChapter(currentNovel.id, currentNovelSourceId); // Re-get
                
                if (lastReadChapter && lastReadChapter.chapterUrl) {
                    readNowHtml = \`
                        <button class="novel-plugin-button" id="novel-plugin-continue-btn">
                            Continue: \${lastReadChapter.chapterTitle}
                        </button>
                    \`;
                } else {
                    readNowHtml = \`
                        <button class="novel-plugin-button" id="novel-plugin-start-btn">
                            Start Reading (Ch 1)
                        </button>
                    \`;
                }

                // --- Source Selector Dropdown ---
                let sourceSelectorHtml = '';
                if (allAvailableMatches.size > 1) {
                    sourceSelectorHtml = \`
                        <div class="novel-plugin-filter-container" style="margin-bottom: 0.5rem;">
                            <label for="novel-plugin-source-select">Source:</label>
                            <select id="novel-plugin-source-select" class="novel-plugin-select">
                                \${[...allAvailableMatches.keys()].map(sourceId => {
                                    const source = sourceRegistry.get(sourceId);
                                    const match = allAvailableMatches.get(sourceId);
                                    return \`<option value="\${sourceId}" \${sourceId === currentNovelSourceId ? 'selected' : ''}>
                                        \${source.name} (\${match.similarity.toFixed(2)})
                                    </option>\`
                                }).join('')}
                            </select>
                        </div>
                    \`;
                } else if (allAvailableMatches.size === 1) {
                     sourceSelectorHtml = \`
                        <div class="novel-plugin-filter-container" style="margin-bottom: 0.5rem;">
                             <label>Source:</label>
                             <span class="novel-plugin-tag">\${sourceRegistry.get(currentNovelSourceId).name}</span>
                        </div>
                     \`;
                }

                container.innerHTML = \`
                    \${sourceSelectorHtml}
                    \${readNowHtml}
                    <button class="novel-plugin-button secondary" id="novel-plugin-view-all-btn">
                        View All Chapters (\${currentNovelChapters.length})
                    </button>
                \`;

                // --- Add Event Handlers ---
                
                const continueBtn = container.querySelector('#novel-plugin-continue-btn');
                if (continueBtn) {
                    continueBtn.onclick = () => {
                        loadAndReadChapter(lastReadChapter.chapterUrl, lastReadChapter.chapterIndex);
                    };
                }
                
                const startBtn = container.querySelector('#novel-plugin-start-btn');
                if (startBtn) {
                    startBtn.onclick = () => {
                        if (currentNovelChapters.length > 0) {
                            loadAndReadChapter(currentNovelChapters[0].url, 0);
                        }
                    };
                }
                
                container.querySelector('#novel-plugin-view-all-btn').onclick = () => {
                    pageState = "chapters";
                    renderUI();
                };

                const sourceSelect = container.querySelector('#novel-plugin-source-select');
                if (sourceSelect) {
                    sourceSelect.onchange = async (e) => {
                        currentNovelSourceId = e.target.value;
                        console.log(\`[novel-plugin] Source changed to: \${currentNovelSourceId}\`);
                        
                        // Show loader while we get new chapters
                        container.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;
                        
                        // Load chapters for the new source
                        await loadChaptersForActiveSource();
                        
                        // Re-render buttons with new chapter data
                        renderChapterButtons(container);
                    };
                }
            }
            
            // --- Page: Manual Match ---
            function renderManualMatchPage(wrapper) {
                if (!currentNovel) { 
                    pageState = "discover";
                    renderUI(); 
                    return; 
                }
                
                const prefill = currentNovel.title.romaji || '';
                wrapper.innerHTML += \`
                    <h1 class="novel-plugin-title">Manual Match</h1>
                    <p class="novel-plugin-subtitle">Search all providers for "\${currentNovel.title.romaji}"</p>
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
                    
                    // --- Search all providers ---
                    const searchPromises = [];
                    sourceRegistry.forEach((source, sourceId) => {
                        searchPromises.push(
                            source.manualSearch(query).then(results => ({ sourceId, sourceName: source.name, results }))
                        );
                    });
                    
                    // Use allSettled to prevent one failure from killing all results
                    const allResults = await Promise.allSettled(searchPromises);
                    resultsContainer.innerHTML = "";
                    
                    let totalResults = 0;
                    allResults.forEach(promiseResult => {
                        if (promiseResult.status === 'rejected') {
                             console.error("[novel-plugin] Manual search failed for a provider:", promiseResult.reason);
                             return; // Skip this provider
                        }
                        
                        const { sourceId, sourceName, results } = promiseResult.value;
                        totalResults += results.length;

                        results.forEach(item => {
                            const itemEl = document.createElement('div');
                            itemEl.className = 'novel-plugin-result-card';
                            itemEl.innerHTML = \`
                                <span class="novel-plugin-provider-tag" data-provider="\${sourceId}">\${sourceName}</span>
                                <img 
                                    src="\${item.image || 'https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'}" 
                                     class="novel-plugin-result-img"
                                    referrerpolicy="no-referrer"
                                     onerror="this.src='https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'"
                                >
                                <div class="novel-plugin-result-stack">
                                    <p class="novel-plugin-result-title" title="\${item.title}">\${item.title}</p>
                                     <p class="novel-plugin-result-chapter">\${item.latestChapter || 'Unknown'}</p>
                                </div>
                                <button class="novel-plugin-view-btn select-btn" data-url="\${item.url}" data-source-id="\${sourceId}">Select</button>
                            \`;
                            itemEl.querySelector('.select-btn').onclick = async (e) => {
                                const url = e.currentTarget.getAttribute("data-url");
                                const newSourceId = e.currentTarget.getAttribute("data-source-id");
                                
                                isLoading = true; 
                                renderUI();
                                
                                const source = sourceRegistry.get(newSourceId);
                                const chapters = await source.getChapters(url);
                                
                                // Set the state
                                currentNovelSourceId = newSourceId;
                                currentNovelChapters = chapters;
                                
                                // Manually create a "match" record for the chapter list
                                allAvailableMatches.clear();
                                allAvailableMatches.set(newSourceId, {
                                    match: { url: url, title: item.title, image: item.image },
                                    similarity: 1.0, // Manual match is always 1.0
                                    chapters: chapters
                                });
                                
                                isLoading = false;
                                if (chapters.length === 0) {
                                    pageState = "manual-match";
                                    renderUI();
                                } else {
                                    pageState = "chapters"; 
                                    renderUI();
                                }
                            };
                            resultsContainer.appendChild(itemEl);
                        });
                    });

                    if (totalResults === 0) {
                        resultsContainer.innerHTML = "<p>No results found on any provider.</p>";
                    }
                }

                searchBtn.onclick = performManualSearch;
                searchInput.onkeyup = (e) => {
                    if (e.key === 'Enter') {
                        performManualSearch();
                    }
                };
                performManualSearch();
            }

            // --- Page: Chapters ---
            async function renderChapterListPage(wrapper) {
                if (!currentNovel) { 
                    pageState = "discover";
                    renderUI(); 
                    return; 
                }

                // Ensure chapters are loaded
                if (currentNovelChapters.length === 0) {
                    // This can happen if user reloads on this page.
                    // Let's try to load them.
                    isLoading = true;
                    renderUI();
                    await loadChaptersForActiveSource();
                    isLoading = false;
                    renderUI(); // Re-render now that we have chapters
                    return;
                }
                
                let chaptersHtml = \`
                    <h2 class="novel-plugin-title">\${currentNovel.title.romaji}</h2>
                    <p class="novel-plugin-subtitle">Chapters (\${sourceRegistry.get(currentNovelSourceId).name})</p>
                    <div class="novel-plugin-chapter-list">
                \`;
                
                if (currentNovelChapters.length === 0) {
                     chaptersHtml += "<p>No chapters found for this provider.</p>";
                } else {
                    const lastReadChapter = getLastReadChapter(currentNovel.id, currentNovelSourceId);
                    
                    currentNovelChapters.forEach((chapter, index) => {
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
                
                wrapper.querySelectorAll(".read-btn").forEach(btn => {
                    btn.onclick = (e) => {
                        const url = e.currentTarget.getAttribute("data-url");
                        const index = e.currentTarget.getAttribute("data-index");
                        loadAndReadChapter(url, index);
                    };
                });
            }
            
            // --- Page: Reader ---
            function renderReaderPage(wrapper) {
                if (!currentNovel || currentChapterContent === null) {
                    pageState = "chapters";
                    renderUI();
                    return;
                }
                
                const readerHeader = document.createElement('div');
                readerHeader.className = 'novel-plugin-reader-header';
                
                const prevBtn = document.createElement('button');
                prevBtn.className = 'novel-plugin-button';
                prevBtn.textContent = '‹ Prev';
                prevBtn.disabled = currentChapterIndex <= 0;
                prevBtn.onclick = () => {
                    if (currentChapterIndex > 0) {
                        const newIndex = currentChapterIndex - 1;
                        loadAndReadChapter(currentNovelChapters[newIndex].url, newIndex);
                    }
                };
                
                const nextBtn = document.createElement('button');
                nextBtn.className = 'novel-plugin-button';
                nextBtn.textContent = 'Next ›';
                nextBtn.disabled = currentChapterIndex >= currentNovelChapters.length - 1;
                nextBtn.onclick = () => {
                    if (currentChapterIndex < currentNovelChapters.length - 1) {
                        const newIndex = currentChapterIndex + 1;
                        loadAndReadChapter(currentNovelChapters[newIndex].url, newIndex);
                    }
                };
                
                const chapterSelect = document.createElement('select');
                chapterSelect.className = 'novel-plugin-select';
                currentNovelChapters.forEach((chapter, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = chapter.title;
                    if (index === currentChapterIndex) {
                        option.selected = true;
                    }
                    chapterSelect.appendChild(option);
                });
                chapterSelect.onchange = (e) => {
                    const newIndex = parseInt(e.target.value, 10);
                    if (newIndex !== currentChapterIndex) {
                        loadAndReadChapter(currentNovelChapters[newIndex].url, newIndex);
                    }
                };
                
                readerHeader.appendChild(prevBtn);
                readerHeader.appendChild(chapterSelect);
                readerHeader.appendChild(nextBtn);
                wrapper.appendChild(readerHeader);
                
                const readerContainer = document.createElement('div');
                readerContainer.className = 'novel-plugin-reader-container';
                
                const readerContent = document.createElement('div');
                readerContent.className = 'novel-plugin-reader-content';
                readerContent.innerHTML = currentChapterContent;
                
                readerContainer.appendChild(readerContent);
                wrapper.appendChild(readerContainer);
            }
        
            // ---------------------------------------------------------------------------
            // 7. MODAL LIFECYCLE
            // ---------------------------------------------------------------------------
        
            function loadAsset(url, id, type, logName) {
                return new Promise(async (resolve, reject) => {
                    try {
                        console.log(\`[novel-plugin] Attempting to fetch \${logName} from: \${url}\`);
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(\`Fetch failed: \${res.status}\`);
                        const textContent = await res.text();
            
                        const el = document.createElement(type);
                        el.id = id;
                        el.textContent = textContent;
                        
                        if (type === 'style') {
                            el.textContent += \`
                                .novel-plugin-reader-header { display: flex; gap: 8px; align-items: center; }
                                .novel-plugin-reader-header .novel-plugin-select { flex-grow: 1; }
                                .novel-plugin-back-btn { width: auto; height: auto; padding: 4px 12px; border-radius: 9999px; }
                            \`;
                        }

                        document.head.appendChild(el);
                        console.log(\`[novel-plugin] External \${logName} fetched and injected.\`);
                        resolve();
                    } catch (err) {
                        console.error(\`[novel-plugin] FAILED to fetch or inject \${logName}: \${err.message}\`, err);
                        reject(err);
                    }
                });
            }

            async function openNovelPage() {
                if (mainLayout) mainLayout.style.display = "none";
                
                const cssUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/styles.css";
                const queriesUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/anilist.js";
                const scrapersUrlNovelBuddy = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/novelbuddy.js";
                const scrapersUrlNovelBin = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/novelbin.js";
                
                try {
                    await Promise.all([
                        loadAsset(cssUrl, STYLE_ID, 'style', 'CSS'),
                        loadAsset(queriesUrl, SCRIPT_QUERY_ID, 'script', 'JS (Queries)'),
                        loadAsset(scrapersUrlNovelBuddy, SCRIPT_SCRAPER_ID_NOVELBUDDY, 'script', 'JS (NovelBuddy)'),
                        loadAsset(scrapersUrlNovelBin, SCRIPT_SCRAPER_ID_NOVELBIN, 'script', 'JS (NovelBin)') 
                    ]);
                    
                    // All assets are loaded, now build the UI
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
                    console.error("[novel-plugin] Could not start modal due to asset load failure.", err.message, err.stack);
                    closeNovelPage(); // Clean up partial loads
                }
            }
            
            function closeNovelPage() {
                if (mainLayout) mainLayout.style.display = "flex";
                
                const removeEl = (id) => {
                    const el = document.getElementById(id);
                    if (el) el.remove();
                };

                removeEl(BACKDROP_ID);
                removeEl(STYLE_ID);
                removeEl(SCRIPT_QUERY_ID);
                removeEl(SCRIPT_SCRAPER_ID_NOVELBUDDY);
                removeEl(SCRIPT_SCRAPER_ID_NOVELBIN); 
                
                const self = document.querySelector(\`script[data-novel-plugin-id="\${SCRIPT_ID}"]\`);
                if (self) self.remove();
                
                console.log("[novel-plugin] Cleaned up and removed.");
            }
            
            // ---------------------------------------------------------------------------
            // 8. START PLUGIN
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

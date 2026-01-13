/// <reference path="./core.d.ts" />

// ---------------------------------------------------------------------------
// MAIN ENTRYPOINT
// ---------------------------------------------------------------------------

function init() {
    $ui.register((ctx) => {
        console.log("[novel-plugin] $ui.register() called.");

        /**
         * Generates the complete, self-contained plugin script.
         */
        function getInjectedScriptString(scriptId: string): string {
            return `
        (async function() {
        
            console.log("[novel-plugin] Injected script running.");

            // ---------------------------------------------------------------------------
            // 1. CONFIGURATION & CONSTANTS
            // ---------------------------------------------------------------------------
            const CONFIG = {
                scriptId: "${scriptId}",
                ids: {
                    style: "novel-plugin-styles",
                    scriptQuery: "novel-plugin-queries",
                    scriptScraperBuddy: "novel-plugin-scrapers-novelbuddy",
                    scriptScraperBin: "novel-plugin-scrapers-novelbin",
                    backdrop: "novel-plugin-backdrop",
                    modal: "novel-plugin-modal-content",
                    wrapper: "novel-plugin-content-wrapper",
                    closeBtn: "novel-plugin-btn-close",
                    searchInput: "novel-plugin-search-input",
                    autoMatchContainer: "novel-plugin-auto-match-container",
                },
                selectors: {
                    appLayout: ".UI-AppLayout__root"
                },
                assets: {
                    css: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/development/src/plugins/Light%20novel/styles.css",
                    queries: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/anilist.js",
                    scraperBuddy: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/providers/novelbuddy.js",
                    scraperBin: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/development/src/plugins/Light%20novel/providers/novelbin.js",
                },
                genres: [
                    "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Hentai",
                    "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological",
                    "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
                ]
            };

            const DEFAULT_SETTINGS = {
                theme: 'dark', // dark, light, sepia
                fontSize: 18,
                lineHeight: 1.6,
                fontFamily: 'sans-serif',
                maxWidth: 800
            };

            // Exit if already running
            if (document.getElementById(CONFIG.ids.modal)) {
                console.log("[novel-plugin] Modal already exists.");
                return;
            }

            // ---------------------------------------------------------------------------
            // 2. STATE MANAGEMENT
            // ---------------------------------------------------------------------------
            const State = {
                page: "discover",
                activeTab: "discover",
                isLoading: false,
                currentNovel: null,         
                currentSourceId: null,      
                currentChapters: [],        
                currentChapterContent: null,
                currentChapterIndex: 0,
                matches: new Map(),         
                sourceRegistry: new Map(),
                showSettings: false
            };

            // Expose registry globally
            window.novelPluginRegistry = {
                registerSource: (source) => {
                    console.log(\`[novel-plugin] Registered source: \${source.name}\`);
                    State.sourceRegistry.set(source.id, source);
                }
            };

            // ---------------------------------------------------------------------------
            // 3. STORAGE SERVICE
            // ---------------------------------------------------------------------------
            const StorageService = {
                getKey: (anilistId, sourceId) => {
                    return (anilistId && sourceId) 
                        ? \`novel_plugin_last_read_\${anilistId}_\${sourceId}\`
                        : \`novel_plugin_last_read_\${anilistId}\`;
                },

                saveChapter: (anilistId, sourceId, chapterUrl, title, index) => {
                    if (!anilistId || !sourceId) return;
                    try {
                        const data = {
                            chapterUrl,
                            chapterTitle: title,
                            chapterIndex: parseInt(index, 10),
                            timestamp: Date.now()
                        };
                        localStorage.setItem(StorageService.getKey(anilistId, sourceId), JSON.stringify(data));
                    } catch (e) {
                        console.error("[novel-plugin] Save error:", e);
                    }
                },

                getLastRead: (anilistId, sourceId) => {
                    if (!anilistId || !sourceId) return null;
                    try {
                        const key = StorageService.getKey(anilistId, sourceId);
                        let data = localStorage.getItem(key);
                        
                        // Migration logic for old keys
                        if (!data) {
                            const oldKey = StorageService.getKey(anilistId, null);
                            const oldData = localStorage.getItem(oldKey);
                            if (oldData) {
                                const parsed = JSON.parse(oldData);
                                StorageService.saveChapter(anilistId, sourceId, parsed.chapterUrl, parsed.chapterTitle, parsed.chapterIndex);
                                localStorage.removeItem(oldKey);
                                return parsed;
                            }
                            return null;
                        }
                        return JSON.parse(data);
                    } catch (e) {
                        return null;
                    }
                },

                getSettings: () => {
                    try {
                        const s = localStorage.getItem('novel_plugin_reader_settings');
                        return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
                    } catch { return DEFAULT_SETTINGS; }
                },

                saveSettings: (settings) => {
                    try {
                        localStorage.setItem('novel_plugin_reader_settings', JSON.stringify(settings));
                    } catch (e) { console.error("Save settings error", e); }
                }
            };

            // ---------------------------------------------------------------------------
            // 4. HTML GENERATORS
            // ---------------------------------------------------------------------------
            const Templates = {
                icon: (name) => {
                    const icons = {
                        link: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>',
                        twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>',
                        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
                    };
                    return icons[name] || icons['link'];
                },

                posterCard: (item) => \`
                    <div class="novel-plugin-poster-card" data-id="\${item.id}">
                        <img src="\${item.coverImage.large}" class="novel-plugin-poster-img" alt="\${item.title.romaji}" style="--cover-color: \${item.coverImage.color || '#8A2BE2'};">
                        <p class="novel-plugin-poster-title" title="\${item.title.romaji}">\${item.title.romaji}</p>
                    </div>\`,

                modalStructure: () => \`
                    <div id="\${CONFIG.ids.modal}">
                        <button id="\${CONFIG.ids.closeBtn}"></button>
                        <div class="novel-plugin-header">
                           <div class="novel-plugin-tabs">
                               <button class="novel-plugin-tab" id="novel-plugin-tab-discover" data-page="discover">Discover</button>
                               <button class="novel-plugin-tab" id="novel-plugin-tab-search" data-page="search">Search</button>
                           </div>
                        </div>
                        <div id="\${CONFIG.ids.wrapper}"></div>
                    </div>\`,
                
                detailsHeader: (media) => \`
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
                    </div>\`,
            };

            // ---------------------------------------------------------------------------
            // 5. CONTROLLER LOGIC
            // ---------------------------------------------------------------------------
            
            async function loadAndReadChapter(chapterUrl, chapterIndex) {
                const source = State.sourceRegistry.get(State.currentSourceId);
                if (!source) return console.error("No active source.");

                State.isLoading = true;
                State.page = "reader";
                renderUI();
                try {
                    const content = await source.getChapterContent(chapterUrl);
                    const numericIndex = parseInt(chapterIndex, 10);
                    
                    State.currentChapterContent = content;
                    State.currentChapterIndex = numericIndex;
                    if (State.currentNovel && State.currentChapters[numericIndex]) {
                        StorageService.saveChapter(
                            State.currentNovel.id, 
                            State.currentSourceId, 
                            chapterUrl, 
                            State.currentChapters[numericIndex].title, 
                            numericIndex
                        );
                    }

                    State.isLoading = false;
                    renderUI();
                    document.getElementById(CONFIG.ids.wrapper).scrollTop = 0;
                } catch (err) {
                    console.error("Error loading chapter:", err);
                    State.isLoading = false;
                    State.page = "chapters";
                    renderUI();
                }
            }

            async function loadChaptersForActiveSource() {
                const source = State.sourceRegistry.get(State.currentSourceId);
                const matchData = State.matches.get(State.currentSourceId);
                
                if (!source || !matchData) {
                    State.currentChapters = [];
                    return [];
                }

                if (matchData.chapters) {
                    State.currentChapters = matchData.chapters;
                    return matchData.chapters;
                }

                console.log(\`[novel-plugin] Fetching chapters for \${source.name}\`);
                const chapters = await source.getChapters(matchData.match.url);
                State.matches.get(State.currentSourceId).chapters = chapters;
                State.currentChapters = chapters;
                return chapters;
            }

            function handleNovelSelection(id) {
                State.currentNovel = { id: id };
                State.currentSourceId = null;
                State.currentChapters = [];
                State.matches.clear();
                State.page = "details";
                renderUI();
            }

            // New Helper: Image Modal
            function showImageModal(src) {
                const modal = document.createElement('div');
                modal.className = 'novel-plugin-image-modal';
                
                const img = document.createElement('img');
                img.src = src;
                
                modal.appendChild(img);
                document.body.appendChild(modal);

                // Close function
                const close = () => {
                    modal.classList.remove('visible');
                    // Remove local ESC listener
                    document.removeEventListener('keydown', handleLocalEsc);
                    setTimeout(() => modal.remove(), 250); 
                };

                // Local ESC Listener (Closes only image, stops propagation so Global ESC doesn't fire)
                const handleLocalEsc = (e) => {
                    if (e.key === 'Escape' || e.code === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation(); 
                        close();
                    }
                };
                document.addEventListener('keydown', handleLocalEsc);

                // Close on click
                modal.onclick = close;

                // Trigger reflow to enable transition
                requestAnimationFrame(() => modal.classList.add('visible'));
            }

            // Global ESC Handler for Main UI
            function handleGlobalEsc(e) {
                if (e.key === 'Escape' || e.code === 'Escape') {
                    // Note: If image modal is open, its own listener calls stopPropagation, 
                    // so this function won't even run. We don't need to check for the modal here.
                    e.preventDefault();
                    console.log("[novel-plugin] Global ESC detected. Closing UI.");
                    cleanup();
                }
            }

            // ---------------------------------------------------------------------------
            // 6. RENDERERS
            // ---------------------------------------------------------------------------

            function renderUI() {
                const wrapper = document.getElementById(CONFIG.ids.wrapper);
                if (!wrapper) return;

                document.querySelectorAll('.novel-plugin-tab').forEach(t => t.classList.remove('active'));
                document.getElementById(\`novel-plugin-tab-\${State.activeTab}\`)?.classList.add('active');

                wrapper.innerHTML = "";
                if (State.isLoading) {
                    wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                    return;
                }

                if (State.page !== "discover" && State.page !== "search") {
                    const backBtn = document.createElement("button");
                    backBtn.className = "novel-plugin-back-btn";
                    backBtn.textContent = "‹ Back";
                    backBtn.onclick = () => {
                        if (State.page === "reader") State.page = "chapters";
                        else if (State.page === "chapters") State.page = "details";
                        else if (State.page === "manual-match") State.page = "details";
                        else if (State.page === "details") State.page = State.activeTab;
                        renderUI();
                    };
                    wrapper.appendChild(backBtn);
                }

                const content = document.createElement("div");
                content.className = "novel-plugin-page-content";
                wrapper.appendChild(content);

                switch (State.page) {
                    case "discover": renderDiscoverPage(content); break;
                    case "search": renderSearchPage(content); break;
                    case "details": renderDetailsPage(content); break;
                    case "manual-match": renderManualMatchPage(content); break;
                    case "chapters": renderChapterListPage(content); break;
                    case "reader": renderReaderPage(content); break;
                }
            }

            // --- Page: Discover ---
            async function renderDiscoverPage(wrapper) {
                wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                const media = await AnilistQueries.getTrendingLightNovels();
                wrapper.innerHTML = "";

                if (!media?.length) {
                    wrapper.innerHTML = "<p>Could not load trending novels.</p>";
                    return;
                }

                const hero = media[0];
                const bannerImg = hero.bannerImage || hero.coverImage.extraLarge;
                wrapper.innerHTML += \`
                    <div class="novel-plugin-hero" style="background-image: linear-gradient(to top, #121212 10%, rgba(18, 18, 18, 0)), url('\${bannerImg}')">
                        <div class="novel-plugin-hero-content">
                            <h1 class="novel-plugin-hero-title">\${hero.title.romaji}</h1>
                             <p class="novel-plugin-hero-score">\${hero.averageScore ? hero.averageScore + '%' : ''} Liked</p>
                            <button class="novel-plugin-button" data-id="\${hero.id}">View Details</button>
                        </div>
                    </div>
                    <h2 class="novel-plugin-section-title">Trending Novels</h2>\`;

                let gridHtml = '<div class="novel-plugin-grid">';
                media.forEach(item => { gridHtml += Templates.posterCard(item); });
                gridHtml += '</div>';
                wrapper.innerHTML += gridHtml;

                wrapper.querySelectorAll('.novel-plugin-poster-card, .novel-plugin-button').forEach(el => {
                    el.onclick = () => handleNovelSelection(el.getAttribute('data-id'));
                });
            }

            // --- Page: Search ---
            function renderSearchPage(wrapper) {
                wrapper.innerHTML += \`
                    <h1 class="novel-plugin-title">Search</h1>
                    <div class="novel-plugin-input-container">
                        <input id="\${CONFIG.ids.searchInput}" class="novel-plugin-input" placeholder="e.g., Classroom of the Elite" />
                        <button id="novel-plugin-search-btn" class="novel-plugin-button">Search</button>
                    </div>
                    <div class="novel-plugin-filter-container">
                         <select id="novel-plugin-sort-select" class="novel-plugin-select">
                            <option value="TRENDING_DESC">Sort by Trending</option>
                            <option value="POPULARITY_DESC">Sort by Popularity</option>
                             <option value="SCORE_DESC">Sort by Score</option>
                        </select>
                        <select id="novel-plugin-genre-select" class="novel-plugin-select">
                            <option value="">All Genres</option>
                            \${CONFIG.genres.map(g => \`<option value="\${g}">\${g}</option>\`).join('')}
                        </select>
                    </div>
                    <div id="novel-plugin-search-results" class="novel-plugin-grid"></div>\`;
                const elements = {
                    input: wrapper.querySelector("#" + CONFIG.ids.searchInput),
                    btn: wrapper.querySelector("#novel-plugin-search-btn"),
                    results: wrapper.querySelector("#novel-plugin-search-results"),
                    sort: wrapper.querySelector("#novel-plugin-sort-select"),
                    genre: wrapper.querySelector("#novel-plugin-genre-select")
                };
                async function performSearch(prefill = false) {
                    const query = elements.input.value;
                    const sort = elements.sort.value;
                    const genre = elements.genre.value || null;

                    elements.results.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                    
                    let media;
                    if (prefill && (!query || !query.trim()) && !genre) {
                        media = await AnilistQueries.getTrendingLightNovels();
                    } else {
                        if (!prefill && (!query || !query.trim())) return;
                        media = await AnilistQueries.searchAnilistLightNovels(query, sort, genre);
                    }

                    elements.results.innerHTML = (!media?.length) ?
                        "<p>No results.</p>" : 
                        media.map(m => Templates.posterCard(m)).join('');
                    elements.results.querySelectorAll('.novel-plugin-poster-card').forEach(el => {
                        el.onclick = () => handleNovelSelection(el.getAttribute('data-id'));
                    });
                }

                elements.btn.onclick = () => performSearch(false);
                elements.input.onkeyup = (e) => { if (e.key === 'Enter') performSearch(false); };
                elements.sort.onchange = () => performSearch(true);
                elements.genre.onchange = () => performSearch(true);
                performSearch(true);
            }

            // --- Page: Details ---
            async function renderDetailsPage(wrapper) {
                if (!State.currentNovel?.id) return handleNovelSelection(null);
                wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                const media = await AnilistQueries.getAnilistLightNovelDetails(State.currentNovel.id);
                wrapper.innerHTML = "";

                if (!media) { wrapper.innerHTML = "<p>Error loading details.</p>"; return; }
                State.currentNovel = media;
                const getTags = (tags) => (tags || []).map(t => 
                    \`<span class="novel-plugin-tag \${t.isMediaSpoiler ? 'novel-plugin-spoiler-tag' : ''}" data-spoiler="\${t.isMediaSpoiler}">\${t.name}</span>\`
                ).join('') || '<p class="muted">No tags.</p>';

                const getLinks = (links) => {
                    if (!links || links.length === 0) return '<p class="muted">No links.</p>';
                    return \`<div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        \${links.map(l => \`
                        <a href="\${l.url}" target="_blank" class="novel-plugin-ext-link-btn" style="margin:0;">
                            <span class="novel-plugin-ext-icon">\${Templates.icon(l.site.toLowerCase().includes('twitter') ? 'twitter' : 'link')}</span>
                            \${l.site}
                        </a>\`).join('')}
                    </div>\`;
                };

                const bannerStyle = \`position:relative;width:100%;min-height:300px;overflow:hidden;background-color:#121212;margin:-1.5rem -1.5rem 0 -1.5rem;max-width:1000px;left:53%;transform:translateX(-50%);margin-top:-4.5rem;border-radius:8px;z-index:0;pointer-events:none;\`;
                const bannerBg = \`position:absolute;inset:0;background:linear-gradient(to top,#121212 15%,rgba(18,18,18,0)) no-repeat,url('\${media.bannerImage || media.coverImage.extraLarge}') center 10%/cover no-repeat;z-index:0;\`;
                
                // Add pointer-events:none to the banner container to stop it from catching clicks intended for elements below or above it in stack
                wrapper.innerHTML = \`
                    <div style="\${bannerStyle}"><div style="\${bannerBg}"></div></div>
                    \${Templates.detailsHeader(media)}
                    <div class="novel-plugin-details-body">
                        <div class="novel-plugin-details-main">
                             <div class="novel-plugin-details-description">
                                <h3>About</h3>
                                <p>\${media.description ? media.description.replace(/<br>/g, ' ') : 'No description.'}</p>
                            </div>
                            \${media.recommendations.nodes.length > 0 ?
                                '<h2 class="novel-plugin-section-title">Recommendations</h2><div class="novel-plugin-grid">' + media.recommendations.nodes.map(r => r.mediaRecommendation ? Templates.posterCard(r.mediaRecommendation) : '').join('') + '</div>' : ''}
                        </div>
                        <div class="novel-plugin-details-sidebar">
                            <div id="novel-plugin-chapter-button-container"></div>
                            <div class="novel-plugin-details-sidebar-section">
                                <h3>External Links</h3>
                                \${getLinks(media.externalLinks)}
                            </div>
                            <div class="novel-plugin-details-sidebar-section">
                                <h3>Genres</h3>
                                <div class="novel-plugin-tags">\${media.genres.map(g => \`<span class="novel-plugin-tag">\${g}</span>\`).join('')}</div>
                            </div>
                            <div class="novel-plugin-details-sidebar-section">
                                <div class="novel-plugin-section-header">
                                    <h3>Tags</h3>
                                    <button id="novel-plugin-spoiler-toggle" class="novel-plugin-spoiler-toggle" style="cursor: pointer;">Show Spoilers</button>
                                </div>
                                <div class="novel-plugin-tags" id="novel-plugin-tags-container">
                                    \${getTags(media.tags)}
                                </div>
                            </div>
                        </div>
                    </div>\`;
                
                // Add Click Listener to Cover Image
                const coverImg = wrapper.querySelector('.novel-plugin-details-cover');
                if (coverImg) {
                    coverImg.title = 'Click to enlarge';
                    coverImg.onclick = (e) => {
                        e.stopPropagation();
                        showImageModal(media.coverImage.extraLarge || media.coverImage.large);
                    };
                }

                const spoilerToggle = wrapper.querySelector('#novel-plugin-spoiler-toggle');
                const tagsContainer = wrapper.querySelector('#novel-plugin-tags-container');
                
                if (spoilerToggle && tagsContainer) {
                    let showSpoilers = false;
                    spoilerToggle.onclick = (e) => {
                        e.preventDefault();
                        showSpoilers = !showSpoilers;
                        if (showSpoilers) {
                            tagsContainer.classList.add('show-spoilers');
                            spoilerToggle.textContent = 'Hide Spoilers';
                        } else {
                            tagsContainer.classList.remove('show-spoilers');
                            spoilerToggle.textContent = 'Show Spoilers';
                        }
                    };
                }

                wrapper.querySelectorAll('.novel-plugin-poster-card').forEach(el => {
                    if (el.getAttribute('data-id') !== media.id) {
                        el.onclick = () => handleNovelSelection(el.getAttribute('data-id'));
                    }
                });

                const btnContainer = wrapper.querySelector('#novel-plugin-chapter-button-container');
                const autoMatchEl = document.createElement('div');
                autoMatchEl.id = CONFIG.ids.autoMatchContainer;
                autoMatchEl.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;
                btnContainer.appendChild(autoMatchEl);

                const promises = [];
                State.sourceRegistry.forEach(src => promises.push(src.autoMatch(media.title.romaji, media.title.english)));
                const results = await Promise.allSettled(promises);
                
                State.matches.clear();
                let bestMatch = null;
                const sourceIds = [...State.sourceRegistry.keys()];

                results.forEach((res, idx) => {
                    if (res.status === 'fulfilled' && res.value) {
                        const sid = sourceIds[idx];
                        State.matches.set(sid, { ...res.value, chapters: null });
                        if (!bestMatch || res.value.similarity > bestMatch.similarity) {
                            bestMatch = { ...res.value, sourceId: sid };
                        }
                    }
                });
                if (bestMatch) {
                    State.currentSourceId = bestMatch.sourceId;
                    loadChaptersForActiveSource().then(() => renderChapterButtons(autoMatchEl));
                } else {
                    autoMatchEl.innerHTML = \`<p class="novel-plugin-error-text">No matches found.</p>\`;
                }

                const manBtn = document.createElement('button');
                manBtn.className = 'novel-plugin-button secondary';
                manBtn.textContent = 'Manual Search';
                manBtn.onclick = () => { State.page = "manual-match"; renderUI(); };
                btnContainer.appendChild(manBtn);
            }

            function renderChapterButtons(container) {
                const lastRead = StorageService.getLastRead(State.currentNovel.id, State.currentSourceId);
                const readBtnHtml = lastRead && lastRead.chapterUrl
                    ? \`<button class="novel-plugin-button" id="novel-plugin-continue-btn">Continue: \${lastRead.chapterTitle}</button>\`
                    : \`<button class="novel-plugin-button" id="novel-plugin-start-btn">Start Reading (Ch 1)</button>\`;
                let selectorHtml = '';
                if (State.matches.size > 1) {
                    selectorHtml = \`<div class="novel-plugin-filter-container" style="margin-bottom:0.5rem;"><label>Source:</label><select id="novel-plugin-source-select" class="novel-plugin-select">\${[...State.matches.keys()].map(sid => \`<option value="\${sid}" \${sid === State.currentSourceId ? 'selected' : ''}>\${State.sourceRegistry.get(sid).name} (\${State.matches.get(sid).similarity.toFixed(2)})</option>\`).join('')}</select></div>\`;
                }

                container.innerHTML = \`\${selectorHtml}\${readBtnHtml}<button class="novel-plugin-button secondary" id="novel-plugin-view-all-btn">View All Chapters (\${State.currentChapters.length})</button>\`;
                container.querySelector('#novel-plugin-continue-btn')?.addEventListener('click', () => loadAndReadChapter(lastRead.chapterUrl, lastRead.chapterIndex));
                container.querySelector('#novel-plugin-start-btn')?.addEventListener('click', () => { if (State.currentChapters.length) loadAndReadChapter(State.currentChapters[0].url, 0); });
                container.querySelector('#novel-plugin-view-all-btn').onclick = () => { State.page = "chapters"; renderUI(); };
                
                const select = container.querySelector('#novel-plugin-source-select');
                if (select) {
                    select.onchange = async (e) => {
                        State.currentSourceId = e.target.value;
                        container.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;
                        await loadChaptersForActiveSource();
                        renderChapterButtons(container);
                    };
                }
            }

            // --- Page: Manual Match ---
            function renderManualMatchPage(wrapper) {
                if (!State.currentNovel) { State.page = "discover"; renderUI(); return; }
                
                wrapper.innerHTML += \`
                    <h1 class="novel-plugin-title">Manual Match</h1>
                    <div class="novel-plugin-input-container">
                        <input id="\${CONFIG.ids.searchInput}" class="novel-plugin-input" value="\${(State.currentNovel.title.romaji || '').replace(/"/g, '&quot;')}"/>
                        <button id="novel-plugin-manual-search-btn" class="novel-plugin-button">Search</button>
                    </div>
                    <div id="novel-plugin-manual-results" class="novel-plugin-manual-list"></div>\`;

                const elements = {
                    input: wrapper.querySelector('#' + CONFIG.ids.searchInput),
                    btn: wrapper.querySelector('#novel-plugin-manual-search-btn'),
                    results: wrapper.querySelector('#novel-plugin-manual-results')
                };

                async function search() {
                    const query = elements.input.value;
                    if (!query || !query.trim()) return;
                    elements.results.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;

                    const promises = [];
                    State.sourceRegistry.forEach((src, id) => {
                        promises.push(src.manualSearch(query).then(res => ({ id, name: src.name, res })));
                    });
                    const outcomes = await Promise.allSettled(promises);
                    elements.results.innerHTML = "";
                    let count = 0;
                    outcomes.forEach(o => {
                        if (o.status === 'rejected') return;
                        const { id, name, res } = o.value;
                        count += res.length;
                        res.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'novel-plugin-result-card';
                            div.innerHTML = \`
                                <span class="novel-plugin-provider-tag">\${name}</span>
                                <img src="\${item.image}" class="novel-plugin-result-img" onerror="this.src='https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'">
                                <div class="novel-plugin-result-stack">
                                    <p class="novel-plugin-result-title">\${item.title}</p>
                                    <p class="novel-plugin-result-chapter">\${item.latestChapter || 'Unknown'}</p>
                                </div>
                                <button class="novel-plugin-view-btn select-btn">Select</button>\`;
                            div.querySelector('.select-btn').onclick = async () => {
                                State.isLoading = true;
                                renderUI();
                                const chaps = await State.sourceRegistry.get(id).getChapters(item.url);
                                State.currentSourceId = id;
                                State.currentChapters = chaps;
                                State.matches.clear();
                                State.matches.set(id, { match: { url: item.url, title: item.title }, similarity: 1.0, chapters: chaps });
                                State.isLoading = false;
                                State.page = chaps.length ? "chapters" : "manual-match";
                                renderUI();
                            };
                            elements.results.appendChild(div);
                        });
                    });
                    if (count === 0) elements.results.innerHTML = "<p>No results found.</p>";
                }

                elements.btn.onclick = search;
                elements.input.onkeyup = (e) => { if (e.key === 'Enter') search(); };
                search();
            }

            // --- Page: Chapters ---
            async function renderChapterListPage(wrapper) {
                if (!State.currentNovel) { State.page = "discover"; renderUI(); return; }
                if (!State.currentChapters.length) {
                    State.isLoading = true;
                    renderUI();
                    await loadChaptersForActiveSource();
                    State.isLoading = false; renderUI();
                    return;
                }

                const lastRead = StorageService.getLastRead(State.currentNovel.id, State.currentSourceId);
                let listHtml = State.currentChapters.map((ch, idx) => {
                    const isLast = lastRead && lastRead.chapterIndex === idx;
                    return \`
                        <div class="novel-plugin-chapter-item \${isLast ? 'last-read' : ''}">
                            <p class="novel-plugin-chapter-title" title="\${ch.title}">\${isLast ? '<span>★</span>' : ''} \${ch.title}</p>
                            <button class="novel-plugin-view-btn read-btn" data-url="\${ch.url}" data-index="\${idx}">Read</button>
                        </div>\`;
                }).join('');
                wrapper.innerHTML += \`
                    <h2 class="novel-plugin-title">\${State.currentNovel.title.romaji}</h2>
                    <p class="novel-plugin-subtitle">Chapters (\${State.sourceRegistry.get(State.currentSourceId).name})</p>
                    <div class="novel-plugin-chapter-list">\${listHtml || '<p>No chapters.</p>'}</div>\`;

                wrapper.querySelectorAll(".read-btn").forEach(btn => {
                    btn.onclick = () => loadAndReadChapter(btn.getAttribute("data-url"), btn.getAttribute("data-index"));
                });
            }

            // --- Page: Reader (UPDATED with Settings) ---
            function renderReaderPage(wrapper) {
                if (!State.currentNovel || !State.currentChapterContent) { State.page = "chapters"; renderUI(); return; }

                // 1. Header
                const header = document.createElement('div');
                header.className = 'novel-plugin-reader-header';

                const createBtn = (txt, disabled, fn) => {
                    const b = document.createElement('button');
                    b.className = 'novel-plugin-button';
                    b.textContent = txt;
                    b.disabled = disabled;
                    b.onclick = fn;
                    return b;
                };

                // Settings Button
                const settingsBtn = document.createElement('button');
                settingsBtn.className = 'novel-plugin-button icon-only';
                settingsBtn.innerHTML = Templates.icon('settings');
                settingsBtn.title = "Reader Settings";
                settingsBtn.onclick = () => {
                    State.showSettings = !State.showSettings;
                    const panel = document.getElementById('novel-plugin-settings-panel');
                    if (panel) panel.style.display = State.showSettings ? 'block' : 'none';
                };

                const prev = createBtn('‹ Prev', State.currentChapterIndex <= 0, () => {
                   const idx = State.currentChapterIndex - 1;
                   loadAndReadChapter(State.currentChapters[idx].url, idx);
                });
                const next = createBtn('Next ›', State.currentChapterIndex >= State.currentChapters.length - 1, () => {
                   const idx = State.currentChapterIndex + 1;
                   loadAndReadChapter(State.currentChapters[idx].url, idx);
                });
                const select = document.createElement('select');
                select.className = 'novel-plugin-select';
                State.currentChapters.forEach((ch, i) => {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = ch.title;
                    if (i === State.currentChapterIndex) opt.selected = true;
                    select.appendChild(opt);
                });
                select.onchange = (e) => {
                    const idx = parseInt(e.target.value, 10);
                    if (idx !== State.currentChapterIndex) loadAndReadChapter(State.currentChapters[idx].url, idx);
                };

                header.append(prev, select, next, settingsBtn);
                wrapper.appendChild(header);

                // 2. Settings Panel
                const currentSettings = StorageService.getSettings();
                const settingsPanel = document.createElement('div');
                settingsPanel.id = 'novel-plugin-settings-panel';
                settingsPanel.className = 'novel-plugin-settings-panel';
                settingsPanel.style.display = State.showSettings ? 'block' : 'none';

                const createSettingRow = (label, input) => {
                    const row = document.createElement('div');
                    row.className = 'novel-plugin-setting-row';
                    const lbl = document.createElement('label');
                    lbl.textContent = label;
                    row.appendChild(lbl);
                    row.appendChild(input);
                    return row;
                };

                // Apply function
                const applySettings = (s) => {
                    const c = document.querySelector('.novel-plugin-reader-content');
                    if(!c) return;
                    
                    // Theme Map
                    const themes = {
                        dark: { bg: '#121212', text: '#e0e0e0' },
                        light: { bg: '#f5f5f5', text: '#121212' },
                        sepia: { bg: '#f4ecd8', text: '#5b4636' }
                    };
                    const theme = themes[s.theme] || themes.dark;
                    
                    c.style.backgroundColor = theme.bg;
                    c.style.color = theme.text;
                    c.style.fontSize = s.fontSize + 'px';
                    c.style.lineHeight = s.lineHeight;
                    c.style.fontFamily = s.fontFamily;
                    c.style.maxWidth = s.maxWidth + 'px';
                    
                    StorageService.saveSettings(s);
                };

                // Controls
                // Theme
                const themeSelect = document.createElement('select');
                themeSelect.className = 'novel-plugin-select small';
                ['dark', 'light', 'sepia'].forEach(t => {
                    const o = document.createElement('option');
                    o.value = t; o.textContent = t.charAt(0).toUpperCase() + t.slice(1);
                    if (t === currentSettings.theme) o.selected = true;
                    themeSelect.appendChild(o);
                });
                themeSelect.onchange = (e) => { currentSettings.theme = e.target.value; applySettings(currentSettings); };
                
                // Font Size
                const fsInput = document.createElement('input');
                fsInput.type = 'range'; fsInput.min = "12"; fsInput.max = "32"; fsInput.value = currentSettings.fontSize;
                fsInput.oninput = (e) => { currentSettings.fontSize = e.target.value; applySettings(currentSettings); };

                // Line Height
                const lhInput = document.createElement('input');
                lhInput.type = 'range'; lhInput.min = "1.0"; lhInput.max = "2.5"; lhInput.step = "0.1"; lhInput.value = currentSettings.lineHeight;
                lhInput.oninput = (e) => { currentSettings.lineHeight = e.target.value; applySettings(currentSettings); };

                // Font Family
                const ffSelect = document.createElement('select');
                ffSelect.className = 'novel-plugin-select small';
                const fonts = { 'Sans Serif': 'sans-serif', 'Serif': 'serif', 'Monospace': 'monospace' };
                Object.entries(fonts).forEach(([k, v]) => {
                    const o = document.createElement('option');
                    o.value = v; o.textContent = k;
                    if (v === currentSettings.fontFamily) o.selected = true;
                    ffSelect.appendChild(o);
                });
                ffSelect.onchange = (e) => { currentSettings.fontFamily = e.target.value; applySettings(currentSettings); };

                // Max Width
                const mwInput = document.createElement('input');
                mwInput.type = 'range'; mwInput.min = "400"; mwInput.max = "1200"; mwInput.step = "50"; mwInput.value = currentSettings.maxWidth;
                mwInput.oninput = (e) => { currentSettings.maxWidth = e.target.value; applySettings(currentSettings); };

                settingsPanel.appendChild(createSettingRow('Theme', themeSelect));
                settingsPanel.appendChild(createSettingRow('Font Size', fsInput));
                settingsPanel.appendChild(createSettingRow('Line Height', lhInput));
                settingsPanel.appendChild(createSettingRow('Font Family', ffSelect));
                settingsPanel.appendChild(createSettingRow('Page Width', mwInput));
                
                wrapper.appendChild(settingsPanel);

                // 3. Content
                const container = document.createElement('div');
                container.className = 'novel-plugin-reader-container';
                const contentDiv = document.createElement('div');
                contentDiv.className = 'novel-plugin-reader-content';
                contentDiv.innerHTML = State.currentChapterContent;
                container.appendChild(contentDiv);
                wrapper.appendChild(container);

                // Apply initial settings
                setTimeout(() => applySettings(currentSettings), 0);
            }

            // ---------------------------------------------------------------------------
            // 7. INITIALIZATION & LIFECYCLE
            // ---------------------------------------------------------------------------

            function loadAsset(url, id, type, logName) {
                return fetch(url).then(res => {
                    if (!res.ok) throw new Error(\`Status \${res.status}\`);
                    return res.text();
                }).then(txt => {
                    const el = document.createElement(type);
                    el.id = id;
                    el.textContent = txt;
                    if (type === 'style') {
                        // INJECTED CSS UPDATES FOR SETTINGS & HEADER FIXES
                        el.textContent += \`
                            .novel-plugin-reader-header { 
                                display: flex; 
                                gap: 8px; 
                                align-items: center; 
                                position: sticky; 
                                top: 0; 
                                background: transparent; 
                                z-index: 10; 
                                padding-bottom: 10px; 
                            } 
                            
                            /* Constraint Buttons: Prevent them from growing */
                            .novel-plugin-reader-header .novel-plugin-button {
                                box-sizing: border-box !important;
                                height: 42px !important;
                                width: auto !important; /* Force width to fit content */
                                flex: 0 0 auto !important; /* Do not grow, do not shrink */
                                margin: 0;
                                padding: 0 16px; /* Comfortable padding */
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                white-space: nowrap;
                            }

                            /* Settings Icon Special Handling */
                            .novel-plugin-reader-header .novel-plugin-button.icon-only {
                                min-width: 42px;
                                padding: 0;
                            }

                            /* Select: Force it to take available space */
                            .novel-plugin-reader-header .novel-plugin-select { 
                                box-sizing: border-box !important;
                                height: 42px !important;
                                flex: 1 !important;    /* Grow to fill center */
                                width: auto !important;
                                margin: 0;
                                padding: 0 10px;
                                line-height: normal;
                            }
                            
                            .novel-plugin-back-btn { width: auto; height: auto; padding: 4px 12px; border-radius: 9999px; }
                            
                            .novel-plugin-reader-container { display: flex; justify-content: center; padding: 20px; background: #000; min-height: 80vh; }
                            .novel-plugin-reader-content { 
                                width: 100%; 
                                padding: 40px; 
                                border-radius: 4px;
                                text-align: left;
                                transition: all 0.2s ease;
                            }
                            .novel-plugin-reader-content p { margin-bottom: 1em; }

                            /* FIX: Ensure header sits above the banner so cover image is clickable */
                            .novel-plugin-details-header {
                                position: relative !important;
                                z-index: 2 !important;
                            }
                            /* Ensure details cover image is clickable */
                            .novel-plugin-details-cover {
                                z-index: 3 !important;
                                cursor: zoom-in !important;
                                pointer-events: auto !important;
                                transition: transform 0.2s;
                            }
                            .novel-plugin-details-cover:hover {
                                transform: scale(1.02);
                            }

                            /* Settings Panel Styles */
                            .novel-plugin-settings-panel {
                                background: #2a2a2a;
                                border: 1px solid #3a3a3a;
                                border-radius: 8px;
                                padding: 15px;
                                margin-bottom: 15px;
                                display: none;
                            }
                            .novel-plugin-setting-row {
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                margin-bottom: 10px;
                            }
                            .novel-plugin-setting-row:last-child { margin-bottom: 0; }
                            .novel-plugin-setting-row label { font-size: 0.9em; color: #ccc; }
                            .novel-plugin-select.small { width: 120px; padding: 4px; font-size: 0.85em; }
                            
                            /* --- New Image Modal Styles --- */
                            .novel-plugin-image-modal {
                                position: fixed;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: rgba(0, 0, 0, 0.85);
                                backdrop-filter: blur(8px);
                                -webkit-backdrop-filter: blur(8px);
                                z-index: 99999;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                cursor: pointer;
                                opacity: 0;
                                transition: opacity 0.25s ease;
                                pointer-events: none;
                            }
                            .novel-plugin-image-modal.visible {
                                opacity: 1;
                                pointer-events: auto;
                            }
                            .novel-plugin-image-modal img {
                                max-width: 90vw;
                                max-height: 90vh;
                                border-radius: 8px;
                                box-shadow: 0 0 25px rgba(0,0,0,0.5);
                                transform: scale(0.95);
                                transition: transform 0.25s ease;
                                object-fit: contain;
                            }
                            .novel-plugin-image-modal.visible img {
                                transform: scale(1);
                            }
                        \`;
                    }
                    document.head.appendChild(el);
                    console.log(\`[novel-plugin] Loaded \${logName}\`);
                });
            }

            async function start() {
                const layout = document.querySelector(CONFIG.selectors.appLayout);
                if (layout) layout.style.display = "none";

                try {
                    await Promise.all([
                        loadAsset(CONFIG.assets.css, CONFIG.ids.style, 'style', 'CSS'),
                        loadAsset(CONFIG.assets.queries, CONFIG.ids.scriptQuery, 'script', 'Queries'),
                        loadAsset(CONFIG.assets.scraperBuddy, CONFIG.ids.scriptScraperBuddy, 'script', 'NovelBuddy'),
                        loadAsset(CONFIG.assets.scraperBin, CONFIG.ids.scriptScraperBin, 'script', 'NovelBin')
                    ]);
                    const backdrop = document.createElement("div");
                    backdrop.id = CONFIG.ids.backdrop;
                    backdrop.innerHTML = Templates.modalStructure();
                    document.body.appendChild(backdrop);

                    document.getElementById('novel-plugin-tab-discover').onclick = () => { State.activeTab = "discover"; State.page = "discover"; renderUI(); };
                    document.getElementById('novel-plugin-tab-search').onclick = () => { State.activeTab = "search"; State.page = "search"; renderUI(); };
                    document.getElementById(CONFIG.ids.closeBtn).onclick = cleanup;

                    // REGISTER GLOBAL ESC (Use Bubbling on window to catch after stopPropagation)
                    window.addEventListener('keydown', handleGlobalEsc);

                    renderUI(); 
                } catch (e) {
                    console.error("[novel-plugin] Init failed", e);
                    cleanup();
                }
            }

            function cleanup() {
                const layout = document.querySelector(CONFIG.selectors.appLayout);
                if (layout) layout.style.display = "flex";

                // REMOVE GLOBAL ESC
                window.removeEventListener('keydown', handleGlobalEsc);

                [CONFIG.ids.backdrop, CONFIG.ids.style, CONFIG.ids.scriptQuery, CONFIG.ids.scriptScraperBuddy, CONFIG.ids.scriptScraperBin]
                    .forEach(id => document.getElementById(id)?.remove());
                document.querySelector(\`script[data-novel-plugin-id="\${CONFIG.scriptId}"]\`)?.remove();
                console.log("[novel-plugin] Cleaned up.");
            }

            await start();
        })();`;
        }

        // ---------------------------------------------------------------------------
        // 2. UI REGISTRATION & TRAY
        // ---------------------------------------------------------------------------
        const tray = ctx.newTray({
            tooltipText: "Novel Reader",
            iconUrl: "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/public/ln.png",
            withContent: false,
        });
        tray.onClick(async () => {
            console.log("[novel-plugin] Tray clicked.");
            try {
                if (await ctx.dom.queryOne("#novel-plugin-backdrop")) {
                    console.log("[novel-plugin] Already open.");
                    return;
                }
                const body = await ctx.dom.queryOne("body");
                if (!body) return console.error("[novel-plugin] No body found!");

                const scriptId = `novel-plugin-script-${Date.now()}`;
                const script = await ctx.dom.createElement("script");
                script.setAttribute("data-novel-plugin-id", scriptId);
                script.setText(getInjectedScriptString(scriptId));
                body.append(script);
                console.log(`[novel-plugin] Injected script #${scriptId}`);
            } catch (err) {
                console.error("[novel-plugin] Tray Error:", err);
            }
        });
    });
}

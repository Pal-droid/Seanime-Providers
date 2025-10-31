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
        
            // ---------------------------------------------------------------------------
            // 2. PLUGIN STATE
            // ---------------------------------------------------------------------------
            let pageState = "discover"; // Initial page
            let activeTabState = "discover"; // Tracks the main tab
            let isLoading = false; // Used only for *blocking* renders (e.g., during chapter load)
            let currentNovel = null; // Holds Anilist media object
            let currentChapterContent = null;
            let currentNovelBuddyChapters = []; // Holds matched chapters
            
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
                    '        ' + // Content will be rendered here
                    '    </div>' +
                    '</div>'
                );
            }
        
            // ---------------------------------------------------------------------------
            // 4. ANILIST API (GRAPHQL)
            // ---------------------------------------------------------------------------

            async function fetchAnilist(query, variables) {
                try {
                    const res = await fetch(ANILIST_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                            query: query,
                            variables: variables,
                        }),
                    });
                    if (!res.ok) {
                        throw new Error(\`Network response was not ok: \${res.statusText}\`);
                    }
                    const json = await res.json();
                    return json.data;
                } catch (err) {
                    console.error("[novel-plugin] Anilist API Error:", err);
                    return null;
                }
            }

            async function getTrendingLightNovels() {
                const query = \`
                    query {
                        Page(page: 1, perPage: 20) {
                            media(type: MANGA, format: NOVEL, sort: TRENDING_DESC) {
                                id
                                title { romaji, english }
                                coverImage { extraLarge, large, color }
                                bannerImage
                                averageScore
                            }
                        }
                    }
                \`;
                const data = await fetchAnilist(query);
                return data?.Page?.media || [];
            }

            async function searchAnilistLightNovels(search) {
                const query = \`
                    query ($search: String) {
                        Page(page: 1, perPage: 20) {
                            media(type: MANGA, format: NOVEL, search: $search) {
                                id
                                title { romaji, english }
                                coverImage { extraLarge, large, color }
                                averageScore
                            }
                        }
                    }
                \`;
                const data = await fetchAnilist(query, { search });
                return data?.Page?.media || [];
            }

            async function getAnilistLightNovelDetails(id) {
                const query = \`
                    query ($id: Int) {
                        Media(id: $id, type: MANGA, format: NOVEL) {
                            id
                            title { romaji, english }
                            description(asHtml: false)
                            genres
                            status
                            coverImage { extraLarge, large, color }
                            bannerImage
                            averageScore
                            startDate { year }
                        }
                    }
                \`;
                const data = await fetchAnilist(query, { id });
                return data?.Media || null;
            }

            // ---------------------------------------------------------------------------
            // 5. NOVELBUDDY SCRAPERS (Matcher)
            // ---------------------------------------------------------------------------
        
            // Updated to scrape image and latest chapter
            async function searchNovelBuddy(query) {
                const url = \`\${NOVELBUDDY_URL}/search?q=\${encodeURIComponent(query)}\`;
                try {
                    const res = await fetch(url);
                    const html = await res.text();
                    const results = [];
                    const itemRegex = /<div class="book-item">([\\s\\S]*?)<\\/div>/g;
                    let match;
                    while ((match = itemRegex.exec(html)) !== null) {
                        const block = match[1];
                        const title = block.match(/<a title="([^"]+)"/)?.[1]?.replace(/<span[^>]*>/g, '').replace(/<\\/span>/g, '') || "Unknown Title";
                        const novelUrl = block.match(/href="(\\/novel\\/[^"]+)"/)?.[1] || "#";
                        
                        let image = block.match(/data-src="([^"]+)"/)?.[1] || "";
                        if (image.startsWith("//")) { 
                            image = \`https:\${image}\`; 
                        } else if (image.startsWith("/")) {
                            image = \`\${NOVELBUDDY_URL}\${image}\`;
                        }

                        const latestChapter = block.match(/<span class="latest-chapter"[^>]*>([^<]+)<\\/span>/)?.[1] || "No Chapter";
                        
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
                const url = \`\${NOVELBUDDY_URL}\${novelUrl}\`;
                try {
                    const res = await fetch(url);
                    const html = await res.text();
                    const bookIdMatch = html.match(/var bookId = (\\d+);/);
                    if (!bookIdMatch || !bookIdMatch[1]) {
                        throw new Error("Could not find bookId on novel page.");
                    }
                    const bookId = bookIdMatch[1];
                    const chapterApiUrl = \`\${NOVELBUDDY_URL}/api/manga/\${bookId}/chapters?source=detail\`;
                    const chapterRes = await fetch(chapterApiUrl);
                    const chapterHtml = await chapterRes.text();
                    const chapters = [];
                    const chapterRegex = /<li[^>]*>[\\s\\S]*?<a href="([^"]+)" title="([^"]+)">/g;
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
                const url = \`\${NOVELBUDDY_URL}\${chapterUrl}\`;
                try {
                    const res = await fetch(url);
                    const html = await res.text();
                    let contentHtml = html.match(/<div class="content-inner">([\\s\\S]*?)<\\/div>/)?.[1];
                    if (!contentHtml) {
                        throw new Error("Could not extract chapter content.");
                    }
                    contentHtml = contentHtml.replace(/<script[\\s\\S]*?<\\/` + `script>/gi, "");
                    contentHtml = contentHtml.replace(/<div[^>]*id="pf-[^"]+"[^>]*>[\\s\\S]*?<\\/div>/gi, "");
                    contentHtml = contentHtml.replace(/<div[^>]*style="text-align:center"[^>]*>[\\s\\S]*?<\\/div>/gi, "");
                    contentHtml = contentHtml.replace(/<ins[^>]*>[\\s\\S]*?<\\/ins>/gi, "");
                    contentHtml = contentHtml.replace(/<div>\\s*<div id="pf-[^"]+">[\\s\\S]*?<\\/div>\\s*<\\/div>/gi, "");
                    return contentHtml;
                } catch (err) {
                    console.error("[novel-plugin] ChapterContent Error:", err);
                    return "<p>Error loading chapter content.</p>";
                }
            }

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

            async function findNovelBuddyChapters(romajiTitle, englishTitle) {
                console.log(\`[novel-plugin] Matching... looking for "\${romajiTitle}"\`);
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
                    console.log(\`[novel-plugin] No good match for Romaji title. Retrying with English: "\${englishTitle}"\`);
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
                    console.log(\`[novel-plugin] Found match: "\${bestMatch.title}" with similarity \${highestSimilarity.toFixed(2)}\`);
                    const chapters = await getNovelBuddyDetails(bestMatch.url);
                    return chapters;
                } else {
                    console.log(\`[novel-plugin] No good match found. Best was "\${bestMatch?.title}" (\${highestSimilarity.toFixed(2)})\`);
                    return [];
                }
            }

            // ---------------------------------------------------------------------------
            // 6. UI RENDERING
            // ---------------------------------------------------------------------------
        
            function renderUI() {
                const wrapper = document.getElementById(WRAPPER_ID);
                if (!wrapper) return;
                
                wrapper.innerHTML = ""; // Clear content
                
                // Update active tab based on activeTabState
                document.querySelectorAll('.novel-plugin-tab').forEach(tab => tab.classList.remove('active'));
                document.getElementById(\`novel-plugin-tab-\${activeTabState}\`)?.classList.add('active');
                
                if (isLoading) {
                    wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                    return;
                }
                
                // --- Back Button ---
                if (pageState !== "discover" && pageState !== "search") {
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
                const media = await getTrendingLightNovels();
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
                            <p class="novel-plugin-hero-score">\${heroMedia.averageScore ? heroMedia.averageScore + '%' : ''} Liked</p>
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
                        pageState = "details";
                        renderUI();
                    };
                });
            }

            // --- Page: Search (Sync) ---
            function renderSearchPage(wrapper) {
                wrapper.innerHTML += \`
                    <h1 class="novel-plugin-title">Search</h1>
                    <p class="novel-plugin-subtitle">Search for light novels from Anilist</p>
                    <div class="novel-plugin-input-container">
                        <input id="\${SEARCH_INPUT_ID}" class="novel-plugin-input" placeholder="e.g., Classroom of the Elite" />
                        <button id="novel-plugin-search-btn" class="novel-plugin-button">Search</button>
                    </div>
                    <div id="novel-plugin-search-results" class="novel-plugin-grid">
                        <!-- Results will be injected here -->
                    </div>
                \`;
                
                const searchBtn = wrapper.querySelector("#novel-plugin-search-btn");
                const searchInput = wrapper.querySelector("#" + SEARCH_INPUT_ID);
                const resultsContainer = wrapper.querySelector("#novel-plugin-search-results");

                async function performSearch() {
                    const query = searchInput.value;
                    if (!query || query.trim() === "") return;
                    
                    resultsContainer.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                    const media = await searchAnilistLightNovels(query);
                    resultsContainer.innerHTML = "";
                    
                    if (media.length === 0) {
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
                
                searchBtn.onclick = performSearch;
                searchInput.onkeyup = (e) => {
                    if (e.key === 'Enter') {
                        performSearch();
                    }
                };
            }
            
            // --- Page: Details (Async) ---
            async function renderDetailsPage(wrapper) {
                if (!currentNovel || !currentNovel.id) {
                    console.error("No novel ID, returning to discover.");
                    pageState = "discover";
                    renderUI();
                    return;
                }
                
                wrapper.innerHTML = \`<div class="novel-plugin-loader"></div>\`;
                const media = await getAnilistLightNovelDetails(currentNovel.id);
                wrapper.innerHTML = ""; 
                
                if (!media) {
                    wrapper.innerHTML = "<p>Error loading details.</p>";
                    return;
                }
                
                currentNovel = media; 
                const bannerImg = media.bannerImage || media.coverImage.extraLarge;
                
                let bannerHtml = \`
                    <div class="novel-plugin-details-banner" style="background-image: linear-gradient(to top, #121212 15%, rgba(18, 18, 18, 0)), url('\${bannerImg}')">
                    </div>
                \`;
                
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

                let bodyHtml = \`
                    <div class="novel-plugin-details-body">
                        <div class="novel-plugin-details-description">
                            <h3>About</h3>
                            <p>\${media.description ? media.description.replace(/<br>/g, ' ') : 'No description available.'}</p>
                        </div>
                        <div class="novel-plugin-details-sidebar">
                            <h3>Genres</h3>
                            <div class="novel-plugin-tags">
                                \${media.genres.map(g => \`<span class="novel-plugin-tag">\${g}</span>\`).join('')}
                            </div>
                            <div id="novel-plugin-chapter-button-container">
                                <!-- Buttons added dynamically -->
                            </div>
                        </div>
                    </div>
                \`;

                wrapper.innerHTML = bannerHtml + headerHtml + bodyHtml;

                const chapterBtnContainer = wrapper.querySelector('#novel-plugin-chapter-button-container');

                // -----------------------------------------------------------------
                // !! CHANGED: Add Manual Search Button *always*
                // -----------------------------------------------------------------
                
                // 1. Create a container for the auto-match results (loader first)
                const autoMatchContainer = document.createElement('div');
                autoMatchContainer.innerHTML = \`<div class="novel-plugin-loader small"></div>\`;
                chapterBtnContainer.appendChild(autoMatchContainer);

                // 2. Add Manual Search Button
                const manualSearchBtn = document.createElement('button');
                manualSearchBtn.className = 'novel-plugin-button secondary'; // New outline style
                manualSearchBtn.id = 'novel-plugin-manual-match-btn';
                manualSearchBtn.textContent = 'Manual Search';
                manualSearchBtn.onclick = () => {
                    pageState = "manual-match";
                    renderUI();
                };
                chapterBtnContainer.appendChild(manualSearchBtn);

                // 3. Asynchronously find chapters and update auto-match container
                const chapters = await findNovelBuddyChapters(media.title.romaji, media.title.english);

                if (chapters && chapters.length > 0) {
                    currentNovelBuddyChapters = chapters;
                    autoMatchContainer.innerHTML = \`
                        <button class="novel-plugin-button" id="novel-plugin-read-btn">
                            Read Chapters (\${chapters.length})
                        </button>
                    \`;
                    autoMatchContainer.querySelector('#novel-plugin-read-btn').onclick = () => {
                        pageState = "chapters";
                        renderUI();
                    };
                } else {
                    autoMatchContainer.innerHTML = \`<p class="novel-plugin-error-text">No automatic match found.</p>\`;
                }
            }
            
            // --- Page: Manual Match ---
            function renderManualMatchPage(wrapper) {
                if (!currentNovel) { pageState = "discover"; renderUI(); return; }
                
                const prefill = currentNovel.title.romaji || '';

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
                    const results = await searchNovelBuddy(query);
                    resultsContainer.innerHTML = ""; // Clear loader

                    if (results.length === 0) {
                        resultsContainer.innerHTML = "<p>No results found on NovelBuddy.</p>";
                        return;
                    }

                    // -----------------------------------------------------------------
                    // !! CHANGED: Render new result card with image
                    // -----------------------------------------------------------------
                    results.forEach(item => {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'novel-plugin-result-card'; // Use new card style
                        itemEl.innerHTML = \`
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
                            <button class="novel-plugin-view-btn select-btn" data-url="\${item.url}">Select</button>
                        \`;
                        
                        itemEl.querySelector('.select-btn').onclick = async (e) => {
                            const url = e.currentTarget.getAttribute("data-url");
                            
                            isLoading = true; 
                            renderUI();
                            
                            const chapters = await getNovelBuddyDetails(url);
                            currentNovelBuddyChapters = chapters;
                            
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
                if (!currentNovel) { pageState = "discover"; renderUI(); return; }

                let chaptersHtml = \`
                    <h2 class="novel-plugin-title">\${currentNovel.title.romaji}</h2>
                    <p class="novel-plugin-subtitle">Chapters</p>
                    <div class="novel-plugin-chapter-list">
                \`;
                
                if (currentNovelBuddyChapters.length === 0) {
                     chaptersHtml += "<p>No chapters found.</p>";
                } else {
                    currentNovelBuddyChapters.forEach(chapter => {
                        chaptersHtml += \`
                            <div class="novel-plugin-chapter-item">
                                <p class="novel-plugin-chapter-title" title="\${chapter.title}">\${chapter.title}</p>
                                <button class="novel-plugin-view-btn read-btn" data-url="\${chapter.url}">Read</button>
                            </div>
                        \`;
                    });
                }
                chaptersHtml += '</div>'; // Close chapter-list
                wrapper.innerHTML += chaptersHtml;
        
                wrapper.querySelectorAll(".read-btn").forEach(btn => {
                    btn.onclick = async (e) => {
                        const url = e.currentTarget.getAttribute("data-url");
                        isLoading = true; 
                        renderUI();
                        
                        const content = await getNovelBuddyChapterContent(url);
                        currentChapterContent = content;
                        
                        isLoading = false; 
                        pageState = "reader";
                        renderUI(); 
                    };
                });
            }
            
            // --- Page: Reader (Sync) ---
            function renderReaderPage(wrapper) {
                if (!currentNovel || !currentChapterContent) {
                    pageState = "chapters";
                    renderUI();
                    return;
                }
                
                wrapper.innerHTML += \`
                    <h2 class="novel-plugin-title">\${currentNovel.title.romaji}</h2>
                    <div class="novel-plugin-reader-container">
                        <div class="novel-plugin-reader-content">
                            \${currentChapterContent}
                        </div>
                    </div>
                \`;
            }
        
            // ---------------------------------------------------------------------------
            // 7. MODAL LIFECYCLE
            // ---------------------------------------------------------------------------
        
            async function openNovelPage() {
                if (mainLayout) mainLayout.style.display = "none";
                
                const loadCss = new Promise(async (resolve, reject) => {
                    const cssUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/src/plugins/Light%20novel/styles.css";
                    
                    try {
                        console.log(\`[novel-plugin] Attempting to fetch CSS from: \${cssUrl}\`);
                        const res = await fetch(cssUrl);
                        if (!res.ok) throw new Error(\`Fetch failed: \${res.status}\`);
                        const cssText = await res.text();
                        const style = document.createElement("style");
                        style.id = STYLE_ID;
                        style.textContent = cssText;
                        document.head.appendChild(style);
                        console.log("[novel-plugin] External CSS fetched and injected.");
                        resolve();
                    } catch (err) {
                        console.error("[novel-plugin] FAILED to fetch or inject CSS:", err);
                        reject(err);
                    }
                });
                
                try {
                    await loadCss;
                    
                    const backdrop = document.createElement("div");
                    backdrop.id = BACKDROP_ID;
                    backdrop.innerHTML = getModalHtml();
                    document.body.appendChild(backdrop);
                    
                    // -----------------------------------------------------------------
                    // !! CHANGED: Update activeTabState *and* pageState
                    // -----------------------------------------------------------------
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
                script.setText(getInjectedScriptString(scriptId));
                body.append(script);
                console.log(`[novel-plugin] Injected script tag #${scriptId}`);

            } catch (err) {
                console.error("[novel-plugin] FATAL ERROR in tray.onClick():", err);
            }
        }); // End of tray.onClick
    }); // End of $ui.register
}


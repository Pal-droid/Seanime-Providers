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
        
            async function searchNovelBuddy(query) {
                
                const url = \`\${NOVELBUDDY_URL}/search?q=\${encodeURIComponent(query)}\`;
                try {
                    const res = await fetch(url);
                    const html = await res.text();
                    const results = [];
                    
                    // --- DOMParser IMPLEMENTATION ---
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");
                    const items = doc.querySelectorAll('.book-item');
                    items.forEach(item => {
                        const titleElement = item.querySelector('h3 a');
                        const title = titleElement?.title?.trim() || "Unknown Title";
                        const novelUrl = titleElement?.getAttribute('href') || "#";
                        let image = item.querySelector('.thumb img.lazy')?.getAttribute('data-src') || "";
                        if (image.startsWith("//")) { 
                            image = \`https:\${image}\`; 
                        } else if (image.startsWith("/")) {
                            image = \`\${NOVELBUDDY_URL}\${image}\`;
                        }
                        const latestChapter = item.querySelector('.latest-chapter')?.textContent?.trim() || "No Chapter";
                      
                        results.push({ 
                            title: title, 
                            url: novelUrl, 
                            image: image, 
                            latestChapter: latestChapter 
                        });
                    });
                    // --- END DOMParser ---
         
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
                    
                    // --- DOMParser IMPLEMENTATION ---
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(chapterHtml, "text/html");
                    const chapterItems = doc.querySelectorAll('ul.chapter-list li a');
                    chapterItems.forEach(link => {
                        const url = link.getAttribute('href');
                        
                        // --- FIX: Prioritize 'strong' tag, then fall back to 'title' attribute ---
                        let title = link.querySelector('strong.chapter-title')?.textContent?.trim();
                        if (!title || title.length === 0) {
                            // Fallback to title attribute if strong tag is missing/empty
                            title = link.getAttribute('title')?.trim() || "Unknown Chapter";
                        }
                        // --- END FIX ---
                        
                        if (url) {
                            chapters.push({ url: url, title: title });
                        }
                    });
                    // --- END DOMParser ---
                    return chapters.reverse(); // Reverse to get CH 1 first
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
            
                    // --- DOMParser IMPLEMENTATION ---
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");
                    const contentElement = doc.querySelector('.content-inner');
            
                    if (!contentElement) {
                        throw new Error("Could not extract chapter content.");
                    }
            
                    // 1. Remove specific unwanted elements (ads, scripts, etc.)
                    contentElement.querySelectorAll('script').forEach(el => el.remove());
                    contentElement.querySelectorAll('div[id^="pf-"]').forEach(el => el.remove());
                    contentElement.querySelectorAll('div[style="text-align:center"]').forEach(el => el.remove());
                    contentElement.querySelectorAll('ins').forEach(el => el.remove());
                    contentElement.querySelectorAll('div[align="center"]').forEach(el => el.remove());
            
                    // 2. Remove empty <div> tags that sometimes break up the text
                    contentElement.querySelectorAll('div').forEach(div => {
                        if (div.innerHTML.trim() === '') {
                            div.remove();
                        }
                    });
            
                    return contentElement.innerHTML;
                    // --- END DOMParser ---
            
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
                    const content = await getNovelBuddyChapterContent(chapterUrl);
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
                
                currentNovel = media; // Store full media object
                
                // NEW: Get last read chapter
                const lastReadChapter = getLastReadChapter(currentNovel.id);
                
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
                            <p class="novel-plugin-subtitle">\${media.title.english ||
                            ''}</p>
                            <div class="novel-plugin-tags">
                                <span class="novel-plugin-tag score">\${media.averageScore ?
                                media.averageScore + '%' : 'N/A'}</span>
                                <span class="novel-plugin-tag">\${media.status ||
                                ''}</span>
                                <span class="novel-plugin-tag">\${media.startDate.year ||
                                ''}</span>
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
                const chapters = await findNovelBuddyChapters(media.title.romaji, media.title.english);
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
                    const results = await searchNovelBuddy(query);
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
                            
                            const chapters = await getNovelBuddyDetails(url);
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
                    const cssUrl = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/src/plugins/Light%20novel/styles.css";
                    
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
                try {
                    await loadCss;
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

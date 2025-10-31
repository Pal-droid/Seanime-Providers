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

function renderUI() {
    const wrapper = document.getElementById(WRAPPER_ID);
    if (!wrapper) return;
    
    wrapper.innerHTML = ""; // Clear content
    
    // Update active tab based on activeTabState
    document.querySelectorAll('.novel-plugin-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`novel-plugin-tab-${activeTabState}`)?.classList.add('active');
    
    if (isLoading) {
        wrapper.innerHTML = `<div class="novel-plugin-loader"></div>`;
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
    wrapper.innerHTML = `<div class="novel-plugin-loader"></div>`;
    const media = await getTrendingLightNovels();
    wrapper.innerHTML = ""; 
    
    if (!media || media.length === 0) {
        wrapper.innerHTML = "<p>Could not load trending novels.</p>";
        return;
    }
    
    const heroMedia = media[0];
    const bannerImg = heroMedia.bannerImage || heroMedia.coverImage.extraLarge;
    wrapper.innerHTML += `
        <div class="novel-plugin-hero" style="background-image: linear-gradient(to top, #121212 10%, rgba(18, 18, 18, 0)), url('${bannerImg}')">
            <div class="novel-plugin-hero-content">
                <h1 class="novel-plugin-hero-title">${heroMedia.title.romaji}</h1>
                <p class="novel-plugin-hero-score">${heroMedia.averageScore ? heroMedia.averageScore + '%' : ''} Liked</p>
                <button class="novel-plugin-button" data-id="${heroMedia.id}">View Details</button>
            </div>
        </div>
    `;

    wrapper.innerHTML += `<h2 class="novel-plugin-section-title">Trending Novels</h2>`;
    let gridHtml = '<div class="novel-plugin-grid">';
    media.forEach(item => {
        gridHtml += `
            <div class="novel-plugin-poster-card" data-id="${item.id}">
                <img src="${item.coverImage.large}" class="novel-plugin-poster-img" alt="${item.title.romaji}" style="--cover-color: ${item.coverImage.color || '#8A2BE2'};">
                <p class="novel-plugin-poster-title" title="${item.title.romaji}">${item.title.romaji}</p>
            </div>
        `;
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
    wrapper.innerHTML += `
        <h1 class="novel-plugin-title">Search</h1>
        <p class="novel-plugin-subtitle">Search for light novels from Anilist</p>
        <div class="novel-plugin-input-container">
            <input id="${SEARCH_INPUT_ID}" class="novel-plugin-input" placeholder="e.g., Classroom of the Elite" />
            <button id="novel-plugin-search-btn" class="novel-plugin-button">Search</button>
        </div>
        <div id="novel-plugin-search-results" class="novel-plugin-grid">
            <!-- Results will be injected here -->
        </div>
    `;
    
    const searchBtn = wrapper.querySelector("#novel-plugin-search-btn");
    const searchInput = wrapper.querySelector("#" + SEARCH_INPUT_ID);
    const resultsContainer = wrapper.querySelector("#novel-plugin-search-results");

    async function performSearch() {
        const query = searchInput.value;
        if (!query || query.trim() === "") return;
        
        resultsContainer.innerHTML = `<div class="novel-plugin-loader"></div>`;
        const media = await searchAnilistLightNovels(query);
        resultsContainer.innerHTML = "";
        
        if (media.length === 0) {
            resultsContainer.innerHTML = "<p>No results found.</p>";
            return;
        }

        let gridHtml = '';
        media.forEach(item => {
            gridHtml += `
                <div class="novel-plugin-poster-card" data-id="${item.id}">
                    <img src="${item.coverImage.large}" class="novel-plugin-poster-img" alt="${item.title.romaji}" style="--cover-color: ${item.coverImage.color || '#8A2BE2'};">
                    <p class="novel-plugin-poster-title" title="${item.title.romaji}">${item.title.romaji}</p>
                </div>
            `;
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
    
    wrapper.innerHTML = `<div class="novel-plugin-loader"></div>`;
    const media = await getAnilistLightNovelDetails(currentNovel.id);
    wrapper.innerHTML = ""; 
    
    if (!media) {
        wrapper.innerHTML = "<p>Error loading details.</p>";
        return;
    }
    
    currentNovel = media; 
    const bannerImg = media.bannerImage || media.coverImage.extraLarge;
    
    let bannerHtml = `
        <div class="novel-plugin-details-banner" style="background-image: linear-gradient(to top, #121212 15%, rgba(18, 18, 18, 0)), url('${bannerImg}')">
        </div>
    `;
    
    let headerHtml = `
        <div class="novel-plugin-details-header">
            <img src="${media.coverImage.extraLarge}" class="novel-plugin-details-cover" style="--cover-color: ${media.coverImage.color || '#8A2BE2'};">
            <div class="novel-plugin-details-info">
                <h1 class="novel-plugin-title">${media.title.romaji}</h1>
                <p class="novel-plugin-subtitle">${media.title.english || ''}</p>
                <div class="novel-plugin-tags">
                    <span class="novel-plugin-tag score">${media.averageScore ? media.averageScore + '%' : 'N/A'}</span>
                    <span class="novel-plugin-tag">${media.status || ''}</span>
                    <span class="novel-plugin-tag">${media.startDate.year || ''}</span>
                </div>
            </div>
        </div>
    `;

    let bodyHtml = `
        <div class="novel-plugin-details-body">
            <div class="novel-plugin-details-description">
                <h3>About</h3>
                <p>${media.description ? media.description.replace(/<br>/g, ' ') : 'No description available.'}</p>
            </div>
            <div class="novel-plugin-details-sidebar">
                <h3>Genres</h3>
                <div class="novel-plugin-tags">
                    ${media.genres.map(g => `<span class="novel-plugin-tag">${g}</span>`).join('')}
                </div>
                <div id="novel-plugin-chapter-button-container">
                    <!-- Buttons added dynamically -->
                </div>
            </div>
        </div>
    `;

    wrapper.innerHTML = bannerHtml + headerHtml + bodyHtml;

    const chapterBtnContainer = wrapper.querySelector('#novel-plugin-chapter-button-container');

    const autoMatchContainer = document.createElement('div');
    autoMatchContainer.innerHTML = `<div class="novel-plugin-loader small"></div>`;
    chapterBtnContainer.appendChild(autoMatchContainer);

    const manualSearchBtn = document.createElement('button');
    manualSearchBtn.className = 'novel-plugin-button secondary'; 
    manualSearchBtn.id = 'novel-plugin-manual-match-btn';
    manualSearchBtn.textContent = 'Manual Search';
    manualSearchBtn.onclick = () => {
        pageState = "manual-match";
        renderUI();
    };
    chapterBtnContainer.appendChild(manualSearchBtn);

    const chapters = await findNovelBuddyChapters(media.title.romaji, media.title.english);

    if (chapters && chapters.length > 0) {
        currentNovelBuddyChapters = chapters;
        autoMatchContainer.innerHTML = `
            <button class="novel-plugin-button" id="novel-plugin-read-btn">
                Read Chapters (${chapters.length})
            </button>
        `;
        autoMatchContainer.querySelector('#novel-plugin-read-btn').onclick = () => {
            pageState = "chapters";
            renderUI();
        };
    } else {
        autoMatchContainer.innerHTML = `<p class="novel-plugin-error-text">No automatic match found.</p>`;
    }
}

// --- Page: Manual Match ---
function renderManualMatchPage(wrapper) {
    if (!currentNovel) { pageState = "discover"; renderUI(); return; }
    
    const prefill = currentNovel.title.romaji || '';

    wrapper.innerHTML += `
        <h1 class="novel-plugin-title">Manual Match</h1>
        <p class="novel-plugin-subtitle">Search NovelBuddy for "${currentNovel.title.romaji}"</p>
        <div class="novel-plugin-input-container">
            <input id="${SEARCH_INPUT_ID}" class="novel-plugin-input" value="${prefill.replace(/"/g, '&quot;')}"/>
            <button id="novel-plugin-manual-search-btn" class="novel-plugin-button">Search</button>
        </div>
        <div id="novel-plugin-manual-results" class="novel-plugin-manual-list">
            <!-- Results will be injected here -->
        </div>
    `;

    const searchBtn = wrapper.querySelector("#novel-plugin-manual-search-btn");
    const searchInput = wrapper.querySelector("#" + SEARCH_INPUT_ID);
    const resultsContainer = wrapper.querySelector("#novel-plugin-manual-results");

    async function performManualSearch() {
        const query = searchInput.value;
        if (!query || query.trim() === "") return;
        
        resultsContainer.innerHTML = `<div class="novel-plugin-loader small"></div>`;
        const results = await searchNovelBuddy(query);
        resultsContainer.innerHTML = ""; // Clear loader

        if (results.length === 0) {
            resultsContainer.innerHTML = "<p>No results found on NovelBuddy.</p>";
            return;
        }

        results.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'novel-plugin-result-card'; 
            itemEl.innerHTML = `
                <img 
                    src="${item.image || 'https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'}" 
                    class="novel-plugin-result-img" 
                    referrerpolicy="no-referrer"
                    onerror="this.src='https://placehold.co/80x110/2A2A2A/4A4A4A?text=N/A'"
                >
                <div class="novel-plugin-result-stack">
                    <p class="novel-plugin-result-title" title="${item.title}">${item.title}</p>
                    <p class="novel-plugin-result-chapter">${item.latestChapter || 'Unknown'}</p>
                </div>
                <button class="novel-plugin-view-btn select-btn" data-url="${item.url}">Select</button>
            `;
            
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

    let chaptersHtml = `
        <h2 class="novel-plugin-title">${currentNovel.title.romaji}</h2>
        <p class="novel-plugin-subtitle">Chapters</p>
        <div class="novel-plugin-chapter-list">
    `;
    
    if (currentNovelBuddyChapters.length === 0) {
         chaptersHtml += "<p>No chapters found.</p>";
    } else {
        currentNovelBuddyChapters.forEach(chapter => {
            chaptersHtml += `
                <div class="novel-plugin-chapter-item">
                    <p class="novel-plugin-chapter-title" title="${chapter.title}">${chapter.title}</p>
                    <button class="novel-plugin-view-btn read-btn" data-url="${chapter.url}">Read</button>
                </div>
            `;
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
    
    wrapper.innerHTML += `
        <h2 class="novel-plugin-title">${currentNovel.title.romaji}</h2>
        <div class="novel-plugin-reader-container">
            <div class="novel-plugin-reader-content">
                ${currentChapterContent}
            </div>
        </div>
    `;
}

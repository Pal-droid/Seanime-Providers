/// <reference path="./core.d.ts" />  

function init() {  
    $ui.register((ctx) => {  
        console.log("[injected-activity-feed] Initializing...");  

        // --- CONSTANTS & STORAGE KEYS ---  
        const INJECTED_BOX_ID = "activity-stories-feed";  
        const VIEWER_ID = "story-viewer-overlay";  
        const SCRIPT_DATA_ATTR = "data-injected-box-script";  

        const STORAGE_KEYS = {
            TARGET_SELECTOR: "anilist-feed.targetSelector",
            BG_STYLE: "anilist-feed.bgStyle",
            RING_COLOR: "anilist-feed.ringColor"
        };

        // --- STATE & SETTINGS ---
        const state = {
            targetSelector: $storage.get(STORAGE_KEYS.TARGET_SELECTOR) ?? '[data-home-toolbar-container="true"]',
            bgStyle: $storage.get(STORAGE_KEYS.BG_STYLE) ?? 'glass',
            ringColor: $storage.get(STORAGE_KEYS.RING_COLOR) ?? '#FF6F61'
        };

        const refs = {
            targetSelector: ctx.fieldRef(state.targetSelector),
            bgStyle: ctx.fieldRef(state.bgStyle),
            ringColor: ctx.fieldRef(state.ringColor)
        };

        // --- TRAY MENU ---
        const tray = ctx.newTray({
            tooltipText: "Friend Activity Settings",
            iconUrl: "https://anilist.co/img/icons/android-chrome-512x512.png",
            withContent: true,
        });

        ctx.registerEventHandler("save-feed-settings", () => {
            $storage.set(STORAGE_KEYS.TARGET_SELECTOR, refs.targetSelector.current);
            $storage.set(STORAGE_KEYS.BG_STYLE, refs.bgStyle.current);
            $storage.set(STORAGE_KEYS.RING_COLOR, refs.ringColor.current);
            
            state.targetSelector = refs.targetSelector.current;
            state.bgStyle = refs.bgStyle.current;
            state.ringColor = refs.ringColor.current;

            ctx.toast.success("Settings saved! Refresh page to apply.");
        });

        tray.render(() => {
            const items = [
                tray.text("Activity Feed Settings", {
                    style: { fontWeight: "bold", fontSize: "14px", marginBottom: "8px" }
                }),
                tray.select("Injection Position", {
                    fieldRef: refs.targetSelector,
                    options: [
                        { label: "Toolbar (Default)", value: '[data-home-toolbar-container="true"]' },
                        { label: "Top of Feed (Activity Wrap)", value: '.activity-feed-wrap' },
                        { label: "Page Container", value: '.container' }
                    ],
                    help: "Where to place the stories bar."
                }),
                tray.select("Background Style", {
                    fieldRef: refs.bgStyle,
                    options: [
                        { label: "Glass (Blur)", value: "glass" },
                        { label: "Solid Dark", value: "dark" },
                        { label: "Solid Light", value: "light" },
                        { label: "Transparent", value: "transparent" }
                    ]
                }),
                // Changed from textfield to select to fix the crash
                tray.select("Ring Color", {
                    fieldRef: refs.ringColor,
                    options: [
                        { label: "Coral (Default)", value: "#FF6F61" },
                        { label: "AniList Blue", value: "#3DB4F2" },
                        { label: "Emerald Green", value: "#10B981" },
                        { label: "Violet", value: "#8B5CF6" },
                        { label: "Hot Pink", value: "#EC4899" },
                        { label: "Orange", value: "#F97316" },
                        { label: "Red", value: "#EF4444" },
                        { label: "White", value: "#FFFFFF" }
                    ]
                }),
                tray.button("Save & Apply", {
                    onClick: "save-feed-settings",
                    intent: "primary-subtle"
                })
            ];

            return tray.stack({ items, style: { gap: "12px", padding: "8px" } });
        });
          
        // ---------------------------------------------------------------------------  
        // INJECTED SCRIPT GENERATOR  
        // ---------------------------------------------------------------------------  
  
        function getSmartInjectedScript(prefilledToken: string = '', settings: typeof state): string {  
            let script = '(function() {\n';  
            
            // --- SETTINGS MAPPING ---
            let bgCss = "";
            switch (settings.bgStyle) {
                case "dark": bgCss = "background-color: #151f2e; border: 1px solid #1F2937;"; break;
                case "light": bgCss = "background-color: #ffffff; color: #111; border: 1px solid #e5e7eb;"; break;
                case "transparent": bgCss = "background-color: transparent; border: none; box-shadow: none;"; break;
                case "glass": default: 
                    bgCss = "background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);"; 
                    break;
            }

            const ringColor = settings.ringColor || '#FF6F61';

            // --- CONSTANTS & STATE ---
            script += 'const BOX_ID = "'+INJECTED_BOX_ID+'";\n';  
            script += 'const VIEWER_ID = "'+VIEWER_ID+'";\n';  
            script += 'const TARGET_SEL = \''+settings.targetSelector+'\'; \n';  
            script += 'const INJECTED_TOKEN = "'+ prefilledToken.replace(/"/g, '\\"') +'";\n';
            script += 'let activeToken = null;\n';
            script += 'let currentStoryTimer = null;\n';
            
            // --- CSS STYLES ---
            const cssStyles = `
                /* FEED STYLES */
                #${INJECTED_BOX_ID} { 
                    z-index: 20; position: relative; margin: 16px 0 24px 0; 
                    ${bgCss}
                    padding: 16px; border-radius: 12px; 
                    font-family: "Inter", sans-serif; 
                    animation: slideInDown 0.4s ease-out; 
                    ${settings.bgStyle === 'light' ? 'color: #1f2937;' : 'color: white;'}
                    min-height: 120px; display: flex; flex-direction: column; justify-content: center;
                }
                .box-header { margin-bottom: 12px; font-weight: 600; font-size: 1rem; display: flex; justify-content: space-between; align-items: center; }
                
                .action-btn { 
                    font-size: 0.75rem; color: #9CA3AF; cursor: pointer; 
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    padding: 4px 10px; border-radius: 12px; transition: all 0.2s;
                }
                .action-btn:hover { background: rgba(255,255,255,0.15); color: white; border-color: rgba(255,255,255,0.3); }

                /* MOBILE BASE STYLES */
                .stories-container { display: flex; overflow-x: auto; gap: 20px; padding-bottom: 5px; scrollbar-width: none; }
                .stories-container::-webkit-scrollbar { display: none; }
                
                .story-item { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; max-width: 65px; transition: transform 0.2s; }
                .story-item:hover { transform: translateY(-2px); }
                
                .story-ring { width: 64px; height: 64px; padding: 3px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; transition: transform 0.2s; }
                
                .story-image { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid #1F2937; }
                .story-name { font-size: 0.75rem; font-weight: 500; ${settings.bgStyle === 'light' ? 'color: #374151;' : 'color: #E5E7EB;'} white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }

                /* DESKTOP / LARGE SCREEN ENHANCEMENTS */
                @media (min-width: 768px) {
                    .stories-container { gap: 40px; } /* Increased spacing */
                    .story-item { max-width: 100px; }
                    .story-ring { width: 88px; height: 88px; padding: 4px; } /* Bigger Icons */
                    .story-name { font-size: 0.85rem; margin-top: 4px; }
                    #${INJECTED_BOX_ID} { padding: 24px; margin: 16px 16px 24px 16px; }
                }

                .token-form { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 10px; }
                .token-input { background: rgba(0,0,0,0.3); border: 1px solid #4B5563; color: white; padding: 8px 12px; border-radius: 6px; width: 80%; max-width: 300px; font-size: 0.9rem; }
                .token-btn { background: #6366F1; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
                .token-btn:hover { background: #4F46E5; }
                .token-help { font-size: 0.75rem; color: #9CA3AF; margin-top: 5px; }
                .token-help a { color: #818CF8; text-decoration: none; }

                .state-msg { text-align: center; color: #9CA3AF; width: 100%; }
                .error-msg { color: #F87171; margin-bottom: 8px; font-size: 0.9rem; }
                
                /* STORY VIEWER STYLES */
                #${VIEWER_ID} { 
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                    background: #000; z-index: 9999; display: none; 
                    flex-direction: column; 
                }
                #${VIEWER_ID}.is-open { display: flex; animation: fadeIn 0.2s; }
                
                .sv-background {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    filter: blur(40px) brightness(0.4); z-index: 0;
                    background-size: cover; background-position: center;
                    transition: background-image 0.5s ease;
                }
                
                .sv-content {
                    position: relative; z-index: 2; width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                }

                .sv-progress-container {
                    display: flex; gap: 4px; padding: 12px 10px; width: 100%; box-sizing: border-box;
                }
                .sv-progress-bar {
                    flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;
                }
                .sv-progress-fill {
                    height: 100%; background: #fff; width: 0%; transition: width 0.1s linear;
                }
                .sv-progress-bar.completed .sv-progress-fill { width: 100%; }
                .sv-progress-bar.active .sv-progress-fill { width: 100%; } 

                .sv-header {
                    display: flex; align-items: center; padding: 0 16px; margin-top: 4px;
                }
                .sv-avatar { width: 32px; height: 32px; border-radius: 50%; margin-right: 10px; border: 1px solid rgba(255,255,255,0.2); }
                .sv-meta { display: flex; flex-direction: column; }
                .sv-username { color: white; font-weight: 600; font-size: 0.9rem; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
                .sv-time { color: rgba(255,255,255,0.7); font-size: 0.75rem; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
                .sv-close { margin-left: auto; color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 5px; opacity: 0.8; }

                .sv-body {
                    flex: 1; display: flex; align-items: center; justify-content: center; position: relative;
                }
                .sv-card-img {
                    width: 85%; max-height: 60vh; object-fit: cover; border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    transform-origin: center center;
                }

                /* ANIMATION CLASSES */
                .sv-animate-enter {
                    animation: storyFadeUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
                
                @keyframes storyFadeUp {
                    0% { opacity: 0; transform: scale(0.95) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }

                .sv-footer {
                    padding: 20px; padding-bottom: 40px; color: white; text-align: center;
                }
                .sv-text-main { font-size: 1.1rem; font-weight: 600; margin-bottom: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); }
                .sv-text-sub { font-size: 0.9rem; color: rgba(255,255,255,0.8); text-shadow: 0 1px 4px rgba(0,0,0,0.8); }

                /* Touch Zones for Navigation */
                .sv-nav-left, .sv-nav-right {
                    position: absolute; top: 100px; bottom: 100px; z-index: 10;
                }
                .sv-nav-left { left: 0; width: 30%; }
                .sv-nav-right { right: 0; width: 70%; }
            `;
            
            script += 'const styles = `' + cssStyles.replace(/\s+/g, ' ') + '`;\n';

            // --- UTILITIES ---
            script += `
            function timeAgo(timestamp) {
                const seconds = Math.floor((new Date() - new Date(timestamp * 1000)) / 1000);
                let interval = seconds / 31536000;
                if (interval > 1) return Math.floor(interval) + "y ago";
                interval = seconds / 2592000;
                if (interval > 1) return Math.floor(interval) + "mo ago";
                interval = seconds / 86400;
                if (interval > 1) return Math.floor(interval) + "d ago";
                interval = seconds / 3600;
                if (interval > 1) return Math.floor(interval) + "h ago";
                interval = seconds / 60;
                if (interval > 1) return Math.floor(interval) + "m ago";
                return "Just now";
            }
            
            function getSegmentedRingStyle(count, isNew) {
                const colorNew = '${ringColor}'; 
                const colorBg = '#334155'; 
                const sep = '#1F2937';
                
                // Single item returns full solid circle (no gap)
                if (count === 1) {
                    return 'background: ' + (isNew ? colorNew : colorBg);
                }
                
                if (count <= 0) return 'background: ' + colorBg;
                
                const deg = 360 / count;
                let stops = [];
                const prime = isNew ? colorNew : colorBg;
                for (let i = 0; i < count; i++) {
                    const s = i * deg; const e = (i + 1) * deg;
                    stops.push(prime + ' ' + s + 'deg ' + (e - 2) + 'deg');
                    stops.push(sep + ' ' + (e - 2) + 'deg ' + e + 'deg');
                }
                return 'background: conic-gradient(from -90deg, ' + stops.join(', ') + ')';
            }
            `;

            // --- STORY VIEWER LOGIC ---
            script += `
            let currentStoryData = null;
            let currentStoryIndex = 0;

            function openStoryViewer(storyGroup) {
                currentStoryData = storyGroup;
                currentStoryIndex = 0;
                renderStoryFrame(true);
                document.getElementById(VIEWER_ID).classList.add('is-open');
            }

            function closeStoryViewer() {
                document.getElementById(VIEWER_ID).classList.remove('is-open');
                if(currentStoryTimer) clearTimeout(currentStoryTimer);
                currentStoryData = null;
            }

            function nextStory() {
                if(!currentStoryData) return;
                if(currentStoryIndex < currentStoryData.activities.length - 1) {
                    currentStoryIndex++;
                    renderStoryFrame(true);
                } else {
                    closeStoryViewer();
                }
            }

            function prevStory() {
                if(!currentStoryData) return;
                if(currentStoryIndex > 0) {
                    currentStoryIndex--;
                    renderStoryFrame(true);
                }
            }

            function renderStoryFrame(shouldAnimate) {
                const v = document.getElementById(VIEWER_ID);
                if(!v || !currentStoryData) return;
                
                const act = currentStoryData.activities[currentStoryIndex];
                
                v.querySelector('.sv-background').style.backgroundImage = 'url(' + (act.coverImage || currentStoryData.profileImage) + ')';
                v.querySelector('.sv-avatar').src = currentStoryData.profileImage;
                v.querySelector('.sv-username').innerText = currentStoryData.name;
                v.querySelector('.sv-time').innerText = act.timestamp;
                
                const progressContainer = v.querySelector('.sv-progress-container');
                progressContainer.innerHTML = '';
                const total = currentStoryData.activities.length;
                
                for(let i=0; i<total; i++) {
                    const bar = document.createElement('div');
                    bar.className = 'sv-progress-bar';
                    const fill = document.createElement('div');
                    fill.className = 'sv-progress-fill';
                    bar.appendChild(fill);

                    if (i < currentStoryIndex) bar.classList.add('completed');
                    if (i === currentStoryIndex) bar.classList.add('active'); 
                    progressContainer.appendChild(bar);
                }

                const img = v.querySelector('.sv-card-img');
                const tMain = v.querySelector('.sv-text-main');
                const tSub = v.querySelector('.sv-text-sub');

                img.src = act.coverImage || 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/default.jpg';
                tMain.innerText = act.textMain;
                tSub.innerText = act.textSub;

                if (shouldAnimate) {
                    img.classList.remove('sv-animate-enter');
                    tMain.classList.remove('sv-animate-enter');
                    tSub.classList.remove('sv-animate-enter');
                    void img.offsetWidth; // Force Reflow
                    img.classList.add('sv-animate-enter');
                    tMain.classList.add('sv-animate-enter');
                    tSub.classList.add('sv-animate-enter');
                }
            }

            function initStoryViewer() {
                if (document.getElementById(VIEWER_ID)) return;
                
                const v = document.createElement('div');
                v.id = VIEWER_ID;
                v.innerHTML = \`
                    <div class="sv-background"></div>
                    <div class="sv-content">
                        <div class="sv-progress-container"></div>
                        <div class="sv-header">
                            <img class="sv-avatar" src="">
                            <div class="sv-meta">
                                <span class="sv-username"></span>
                                <span class="sv-time"></span>
                            </div>
                            <button class="sv-close">&times;</button>
                        </div>
                        <div class="sv-body">
                            <div class="sv-nav-left"></div>
                            <img class="sv-card-img" src="">
                            <div class="sv-nav-right"></div>
                        </div>
                        <div class="sv-footer">
                            <div class="sv-text-main"></div>
                            <div class="sv-text-sub"></div>
                        </div>
                    </div>
                \`;
                document.body.appendChild(v);

                v.querySelector('.sv-close').onclick = closeStoryViewer;
                v.querySelector('.sv-nav-right').onclick = (e) => { e.stopPropagation(); nextStory(); };
                v.querySelector('.sv-nav-left').onclick = (e) => { e.stopPropagation(); prevStory(); };
            }
            `;

            // --- RENDER LOGIC ---
            script += `
            function ensureBox() {
                const target = document.querySelector(TARGET_SEL);
                if (!target) return false;
                if (document.getElementById(BOX_ID)) return true;
                
                const box = document.createElement('div');
                box.id = BOX_ID;
                box.innerHTML = '<style>' + styles + '</style><div id="feed-content"></div>';
                
                if (TARGET_SEL.includes('container') || TARGET_SEL.includes('feed-wrap')) {
                     target.prepend(box);
                } else {
                     target.insertAdjacentElement('afterend', box);
                }
                
                initStoryViewer();
                return true;
            }

            function renderInputForm(error = null) {
                const content = document.getElementById('feed-content');
                if (!content) return;
                
                let html = '<div class="box-header">AniList Friend Activity</div>';
                html += '<div class="token-form">';
                if (error) html += '<div class="error-msg">' + error + '</div>';
                html += '<input type="password" id="ani-token" class="token-input" placeholder="Paste AniList Access Token" />';
                html += '<button id="ani-save-btn" class="token-btn">Load Activity Feed</button>';
                html += '<div class="token-help">Create token at <a href="https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token" target="_blank">AniList API</a></div>';
                html += '</div>';
                
                content.innerHTML = html;

                document.getElementById('ani-save-btn').onclick = () => {
                    const token = document.getElementById('ani-token').value.trim();
                    if (token) {
                        fetchActivities(token);
                    }
                };
            }

            function renderLoading() {
                const content = document.getElementById('feed-content');
                if (!content) return;
                content.innerHTML = '<div class="box-header">Friend Activity <button class="action-btn" disabled style="opacity:0.5">Fetching...</button></div><div class="state-msg"><svg class="animate-spin" style="width:24px; height:24px; margin-right:10px;" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Fetching updates...</div>';
            }

            function renderStories(stories) {
                const content = document.getElementById('feed-content');
                if (!content) return;

                const headerHtml = '<div class="box-header">Friend Activity <button class="action-btn" id="reload-btn">↻ Reload</button></div>';

                if (stories.length === 0) {
                    content.innerHTML = headerHtml + '<div class="state-msg">No recent activity found.</div>';
                } else {
                    const html = stories.map(s => {
                        const ring = getSegmentedRingStyle(s.activities.length, s.status === 'new');
                        return \`
                        <div class="story-item" data-id="\${s.name}">
                            <div class="story-ring" style="\${ring}">
                                <img src="\${s.profileImage}" class="story-image" onerror="this.src='https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png'">
                            </div>
                            <span class="story-name">\${s.name}</span>
                        </div>\`;
                    }).join('');
                    
                    content.innerHTML = headerHtml + '<div class="stories-container">' + html + '</div>';
                    
                    content.querySelectorAll('.story-item').forEach(item => {
                        item.onclick = () => {
                            const name = item.getAttribute('data-id');
                            const story = stories.find(s => s.name === name);
                            if(story) openStoryViewer(story);
                        };
                    });
                }

                document.getElementById('reload-btn').onclick = () => {
                    if (activeToken) fetchActivities(activeToken);
                    else renderInputForm();
                };
            }
            `;

            // --- API FETCH LOGIC ---
            script += `
            async function fetchActivities(token) {
                activeToken = token;
                renderLoading();
                
                const query = \`
                query {
                    Page(page: 1, perPage: 25) {
                        activities(type: MEDIA_LIST, sort: ID_DESC, isFollowing: true) {
                            ... on ListActivity {
                                id
                                status
                                progress
                                createdAt
                                media {
                                    title { romaji english }
                                    coverImage { extraLarge }
                                }
                                user {
                                    name
                                    avatar { medium }
                                }
                            }
                        }
                    }
                }
                \`;

                try {
                    const response = await fetch('https://graphql.anilist.co', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ query: query })
                    });

                    const json = await response.json();
                    
                    if (!response.ok || json.errors) {
                        throw new Error(json.errors ? json.errors[0].message : 'Invalid Token or Network Error');
                    }

                    const rawActs = json.data.Page.activities;
                    const grouped = {};
                    
                    rawActs.forEach(act => {
                        const uName = act.user.name;
                        if (!grouped[uName]) {
                            grouped[uName] = {
                                name: uName,
                                profileImage: act.user.avatar.medium,
                                status: 'new',
                                activities: []
                            };
                        }
                        
                        const title = act.media.title.english || act.media.title.romaji;
                        let textMain = "";
                        let textSub = title;

                        if (act.status.includes('watched episode')) {
                            textMain = 'Watched Episode ' + act.progress;
                        } else if (act.status.includes('read chapter')) {
                            textMain = 'Read Chapter ' + act.progress;
                        } else if (act.status.includes('completed')) {
                            textMain = 'Completed';
                        } else if (act.status.includes('plans to watch')) {
                             textMain = 'Plans to watch';
                        } else {
                            textMain = act.status;
                        }

                        grouped[uName].activities.push({
                            textMain: textMain,
                            textSub: textSub,
                            timestamp: timeAgo(act.createdAt),
                            coverImage: act.media.coverImage.extraLarge
                        });
                    });

                    Object.values(grouped).forEach(g => {
                        g.activities.reverse();
                    });

                    renderStories(Object.values(grouped));

                } catch (e) {
                    console.error(e);
                    renderInputForm("Error: " + e.message);
                }
            }
            `;

            // --- MAIN LOOP ---
            script += `
            function mainLoop() {
                if (!ensureBox()) {
                    setTimeout(mainLoop, 500); 
                    return;
                }
                
                if (INJECTED_TOKEN && INJECTED_TOKEN.trim() !== "") {
                    fetchActivities(INJECTED_TOKEN);
                    return;
                }
                renderInputForm();
            }
            mainLoop();
            `;

            script += '})();\n'; 
            return script;
        }
  
        // ---------------------------------------------------------------------------  
        // INJECTION LOGIC  
        // ---------------------------------------------------------------------------  
  
        const handleContentBox = async (ctx: UiContext) => {  
            const existingScript = await ctx.dom.queryOne(`script[${SCRIPT_DATA_ATTR}]`);
            if (existingScript) return;

            let token = "";
            try {
                // @ts-ignore
                if (typeof $database !== 'undefined' && $database.anilist) {
                    // @ts-ignore
                    token = await $database.anilist.getToken();
                }
            } catch (e) {}

            const script = await ctx.dom.createElement("script");  
            script.setAttribute(SCRIPT_DATA_ATTR, "true");  
            
            // PASS THE SETTINGS TO THE GENERATOR
            const currentSettings = {
                targetSelector: state.targetSelector,
                bgStyle: state.bgStyle,
                ringColor: state.ringColor
            };

            script.setText(getSmartInjectedScript(token, currentSettings));  
            
            const body = await ctx.dom.queryOne("body");
            if (body) body.append(script);
        };  
  
        const cleanupContentBox = async (ctx: UiContext) => {  
            const existingBox = await ctx.dom.queryOne(INJECTED_BOX_SELECTOR);  
            if (existingBox) await existingBox.remove();  
              
            const existingViewer = await ctx.dom.queryOne(`#${VIEWER_ID}`);  
            if (existingViewer) await existingViewer.remove();  
  
            const existingScripts = await ctx.dom.query(`script[${SCRIPT_DATA_ATTR}]`);  
            for (const script of existingScripts) await script.remove();  
        };  
  
        ctx.dom.onReady(async () => {  
            ctx.screen.onNavigate(async (e) => {  
                const isRoot = e.pathname === "/";  
                if (isRoot) await handleContentBox(ctx);  
                else await cleanupContentBox(ctx);  
            });  
            ctx.screen.loadCurrent();   
        });  
    });  
}
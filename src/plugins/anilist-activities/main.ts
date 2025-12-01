/// <reference path="./core.d.ts" />  

function init() {  
    $ui.register((ctx) => {  
        const INJECTED_BOX_ID = "activity-stories-feed";  
        const VIEWER_ID = "story-viewer-overlay";  
        const SCRIPT_DATA_ATTR = "data-injected-box-script";  

        const SELECTOR_MAP = {
            'toolbar': 'div[data-home-toolbar-container="true"]',
            'bottom-page': 'div[data-home-screen-item-divider="true"]',
            'above-watching': 'div[data-library-collection-lists-container="true"]',
        };
        const DEFAULT_CHOICE = 'toolbar'; 

        const STORAGE_KEYS = {
            DROPDOWN_CHOICE: "anilist-feed.dropdownChoice",
            MANUAL_OVERRIDE_SELECTOR: "anilist-feed.manualOverrideSelector",
            BG_STYLE: "anilist-feed.bgStyle",
            RING_COLOR: "anilist-feed.ringColor",
        };

        const initialDropdownChoice = $storage.get(STORAGE_KEYS.DROPDOWN_CHOICE) ?? DEFAULT_CHOICE;
        const initialManualSelector = $storage.get(STORAGE_KEYS.MANUAL_OVERRIDE_SELECTOR) ?? '';
        
        const resolveTargetSelector = (dropdownChoice: string, manualOverride: string): string => {
            return (manualOverride && manualOverride.trim() !== "") 
                ? manualOverride.trim() 
                : SELECTOR_MAP[dropdownChoice] || SELECTOR_MAP[DEFAULT_CHOICE];
        };

        const state = {
            dropdownChoice: initialDropdownChoice,
            manualOverrideSelector: initialManualSelector,
            activeTargetSelector: resolveTargetSelector(initialDropdownChoice, initialManualSelector),
            bgStyle: $storage.get(STORAGE_KEYS.BG_STYLE) ?? 'glass',
            ringColor: $storage.get(STORAGE_KEYS.RING_COLOR) ?? '#FF6F61'
        };

        const refs = {
            dropdownChoice: ctx.fieldRef(state.dropdownChoice),
            manualOverrideSelector: ctx.fieldRef(state.manualOverrideSelector),
            bgStyle: ctx.fieldRef(state.bgStyle),
            ringColor: ctx.fieldRef(state.ringColor)
        };
        
        ctx.registerEventHandler("save-feed-settings", () => {
            const newDropdownChoice = refs.dropdownChoice.current;
            const newManualSelector = refs.manualOverrideSelector.current;

            const finalSelector = resolveTargetSelector(newDropdownChoice, newManualSelector);

            $storage.set(STORAGE_KEYS.DROPDOWN_CHOICE, newDropdownChoice);
            $storage.set(STORAGE_KEYS.MANUAL_OVERRIDE_SELECTOR, newManualSelector);
            $storage.set(STORAGE_KEYS.BG_STYLE, refs.bgStyle.current);
            $storage.set(STORAGE_KEYS.RING_COLOR, refs.ringColor.current);
            
            state.dropdownChoice = newDropdownChoice;
            state.manualOverrideSelector = newManualSelector;
            state.activeTargetSelector = finalSelector;
            state.bgStyle = refs.bgStyle.current;
            state.ringColor = refs.ringColor.current;

            ctx.toast.success("Settings saved! Refresh page to apply.");
        });

        const tray = ctx.newTray({
            tooltipText: "Friend Activity Settings",
            iconUrl: "https://anilist.co/img/icons/android-chrome-512x512.png",
            withContent: true,
        });

        tray.render(() => {
            const items = [
                tray.text("Activity Feed Settings", { style: { fontWeight: "bold", fontSize: "14px", marginBottom: "8px" } }),
                tray.select("Injection Point", {
                    fieldRef: refs.dropdownChoice,
                    options: [
                        { label: "Default (Toolbar)", value: 'toolbar' },
                        { label: "Above Currently Watching", value: 'above-watching' },
                        { label: "Bottom of Page", value: 'bottom-page' },
                    ],
                    help: "Choose a common location to inject the feed."
                }),
                tray.input("Manual Selector Override (CSS)", {
                    fieldRef: refs.manualOverrideSelector,
                    placeholder: "e.g., .my-custom-div",
                    help: "If provided, this CSS selector overrides the dropdown choice above."
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
          
        function getSmartInjectedScript(prefilledToken: string = '', settings: typeof state): string {  
            // --- Logic to calculate dynamic CSS variables ---
            let bgCss = "";
            switch (settings.bgStyle) {
                case "dark": bgCss = "background-color: #151f2e; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);"; break;
                case "light": bgCss = "background-color: #ffffff; color: #111; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);"; break;
                case "transparent": bgCss = "background-color: transparent; box-shadow: none;"; break;
                case "glass": default: 
                    bgCss = "background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);"; 
                    break;
            }

            const ringColor = settings.ringColor || '#FF6F61';
            const IS_LIGHT = settings.bgStyle === 'light';
            const MAIN_TEXT_COLOR = IS_LIGHT ? '#374151' : '#E5E7EB';
            // --- End dynamic CSS variables ---

            const jsString = `
            (function() {
                const BOX_ID = "${INJECTED_BOX_ID}";
                const VIEWER_ID = "${VIEWER_ID}";
                const TARGET_SEL = '${settings.activeTargetSelector}';
                const INJECTED_TOKEN = "${prefilledToken.replace(/"/g, '\\"')}";
                const CACHE_KEY = "anilist-feed-cache";
                const CACHE_DURATION_MS = 300000;
                const STORY_DURATION = 5000;
                const RING_COLOR = '${ringColor}';
                const IS_LIGHT = ${IS_LIGHT};
                
                // Dynamic CSS variables passed from the main script
                const BG_CSS_VAR = \`${bgCss}\`;
                const MAIN_TEXT_COLOR_VAR = \`${MAIN_TEXT_COLOR}\`;
                
                // URL to fetch the external CSS file (per user request)
                const CSS_URL = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/main/src/plugins/anilist-activities/styles.css";

                let activeToken = null;
                let allStoryGroups = [];
                let currentStoryGroupIndex = -1;
                let currentStoryData = null; 
                let currentStoryIndex = 0;
                let currentStoryTimer = null;
                let progressInterval = null;
                let startTime = 0;

                // --- CSS Fetch and Injection Logic ---
                async function fetchAndInjectStyles() {
                    if (document.getElementById('anilist-feed-styles')) return;

                    try {
                        const res = await fetch(CSS_URL);
                        if (!res.ok) throw new Error('Failed to fetch CSS');
                        
                        let cssText = await res.text();

                        // Perform string replacements for dynamic variables and IDs
                        cssText = cssText
                            .replace(new RegExp('\\$\\{INJECTED_BOX_ID\\}', 'g'), BOX_ID)
                            .replace(new RegExp('\\$\\{VIEWER_ID\\}', 'g'), VIEWER_ID)
                            .replace(new RegExp('\\$\\{BG_CSS_VAR\\}', 'g'), BG_CSS_VAR)
                            .replace(new RegExp('\\$\\{MAIN_TEXT_COLOR_VAR\\}', 'g'), MAIN_TEXT_COLOR_VAR);
                        
                        // Inject the final, processed CSS into a style tag
                        const styleTag = document.createElement('style');
                        styleTag.id = 'anilist-feed-styles';
                        styleTag.innerHTML = cssText;
                        document.head.appendChild(styleTag);

                    } catch (e) {
                        console.error("Error injecting external CSS:", e);
                    }
                }
                // --- End CSS Fetch and Injection Logic ---


                // --- UTILITIES (Compact) ---
                function timeAgo(t) {
                    const s = Math.floor((new Date() - new Date(t * 1000)) / 1000);
                    let i = s / 31536000;
                    if (i > 1) return Math.floor(i) + "y ago";
                    i = s / 2592000;
                    if (i > 1) return Math.floor(i) + "mo ago";
                    i = s / 86400;
                    if (i > 1) return Math.floor(i) + "d ago";
                    i = s / 3600;
                    if (i > 1) return Math.floor(i) + "h ago";
                    i = s / 60;
                    if (i > 1) return Math.floor(i) + "m ago";
                    return "Just now";
                }
                
                function getSegmentedRingStyle(count, isNew) {
                    const cN = RING_COLOR; const cB = '#334155'; const sep = '#1F2937';
                    if (count <= 1) return \`background: \${isNew ? cN : cB}\`;
                    const deg = 360 / count;
                    let stops = [];
                    for (let i = 0; i < count; i++) {
                        const s = i * deg; const e = (i + 1) * deg;
                        stops.push(\`\${isNew ? cN : cB} \${s}deg \${e - 2}deg\`);
                        stops.push(\`\${sep} \${e - 2}deg \${e}deg\`);
                    }
                    return 'background: conic-gradient(from -90deg, ' + stops.join(', ') + ')';
                }

                // --- API INTERACTION LOGIC ---
                async function apiCall(query, variables) {
                    if (!activeToken) {
                        console.error("API call failed: No active token.");
                        // Use a custom alert message instead of prompt/alert
                        // Using a standard function name to avoid conflicts in the host environment
                        (typeof $ui !== 'undefined' ? $ui.toast.error : window.alert)("Please enter your AniList Access Token to interact with activities.");
                        return null;
                    }
                    try {
                        const res = await fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + activeToken },
                            body: JSON.stringify({ query, variables })
                        });
                        const json = await res.json();
                        if (!res.ok || json.errors) throw new Error(json.errors ? json.errors[0].message : 'Network Error');
                        return json;
                    } catch (e) {
                        // Display the full error message to the user
                        console.error('AniList API Error:', e.message);
                        (typeof $ui !== 'undefined' ? $ui.toast.error : window.alert)('AniList API Error: ' + e.message);
                        return null;
                    }
                }

                window.likeActivity = async (id) => {
                    // MUTATION: This call is always correct as it doesn't return the full activity object
                    const LIKE_MUTATION = 'mutation ($id: Int) { ToggleLike(id: $id, type: ACTIVITY) { id isLiked likeCount } }';
                    const btn = document.getElementById('sv-like-btn');
                    if (btn) btn.disabled = true;

                    const result = await apiCall(LIKE_MUTATION, { id });
                    if (result) {
                        const data = result.data.ToggleLike;
                        const act = currentStoryData.activities.find(a => a.id === id);
                        if (act) {
                            act.isLiked = data.isLiked;
                            act.likeCount = data.likeCount;
                        }
                        // Re-render the current frame to update the button state
                        renderStoryFrame(false); 
                    }
                    if (btn) btn.disabled = false;
                }

                window.replyActivity = async (id) => {
                    // Use a custom prompt function if necessary, otherwise rely on the host environment's capability
                    const replyText = window.prompt("Enter your reply (Max 140 characters):");
                    if (!replyText || replyText.trim().length === 0) return;
                    if (replyText.length > 140) return (typeof $ui !== 'undefined' ? $ui.toast.error : window.alert)("Reply too long (Max 140 characters).");

                    const REPLY_MUTATION = 'mutation ($activityId: Int, $text: String) { SaveActivityReply(activityId: $activityId, text: $text) { id } }';
                    const btn = document.getElementById('sv-reply-btn');
                    if (btn) btn.disabled = true;

                    const result = await apiCall(REPLY_MUTATION, { activityId: id, text: replyText.trim() });
                    if (result) {
                        (typeof $ui !== 'undefined' ? $ui.toast.success : window.alert)("Reply posted successfully!");
                        // Optionally refresh the reply list if modal is open
                        if (document.getElementById('reply-modal')?.classList.contains('is-open')) {
                            window.showReplies(id, true);
                        }
                    }
                    if (btn) btn.disabled = false;
                }
                
                window.showReplies = async (activityId, forceRefresh = false) => {
                    const replyModal = document.getElementById('reply-modal');
                    const replyList = document.getElementById('reply-list');
                    if (!replyModal || !replyList) return;

                    replyModal.classList.add('is-open');
                    replyList.innerHTML = '<div class="reply-none">Loading replies...</div>';
                    
                    const REPLIES_QUERY = \`
                        query ($activityId: Int) {
                          Activity(id: $activityId) {
                            ... on ListActivity {
                              replies {
                                id
                                text
                                createdAt
                                user {
                                  name
                                  avatar { medium }
                                }
                              }
                            }
                          }
                        }\`;

                    const result = await apiCall(REPLIES_QUERY, { activityId: activityId });
                    
                    if (result && result.data.Activity && result.data.Activity.replies) {
                        const replies = result.data.Activity.replies;
                        if (replies.length === 0) {
                            replyList.innerHTML = '<div class="reply-none">No replies yet. Be the first!</div>';
                        } else {
                            replyList.innerHTML = replies.map(r => \`
                                <div class="reply-item">
                                    <img class="reply-avatar" src="\${r.user.avatar.medium}" onerror="this.src='https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png'">
                                    <div class="reply-body">
                                        <div class="reply-meta">
                                            <span>\${r.user.name}</span> \${timeAgo(r.createdAt)}
                                        </div>
                                        <div class="reply-text">\${r.text.replace(/\\n/g, '<br>')}</div>
                                    </div>
                                </div>
                            \`).join('');
                        }
                    } else {
                        replyList.innerHTML = '<div class="reply-none">Failed to load replies.</div>';
                    }
                }

                window.closeReplies = () => {
                    document.getElementById('reply-modal')?.classList.remove('is-open');
                }

                // --- STORY VIEWER LOGIC ---
                function restartStoryTimer() {
                    if (currentStoryTimer) clearTimeout(currentStoryTimer);
                    if (progressInterval) clearInterval(progressInterval);
                    startTime = Date.now();
                    
                    const activeBar = document.querySelector('.sv-progress-bar.active');
                    if (!activeBar) return;
                    
                    const fill = activeBar.querySelector('.sv-progress-fill');
                    if (fill) fill.style.width = '0%';
                    
                    currentStoryTimer = setTimeout(window.nextStory, STORY_DURATION);
                    progressInterval = setInterval(() => {
                        const percent = Math.min(100, ((Date.now() - startTime) / STORY_DURATION) * 100);
                        if (fill) fill.style.width = percent + '%';
                        if (percent >= 100) clearInterval(progressInterval);
                    }, 100);
                }

                window.openStoryViewer = (storyGroupIndex) => {
                    const storyGroup = allStoryGroups[storyGroupIndex];
                    if (!storyGroup) return;

                    currentStoryData = storyGroup;
                    currentStoryGroupIndex = storyGroupIndex;
                    currentStoryIndex = 0;
                    
                    renderStoryFrame(true);
                    document.getElementById(VIEWER_ID).classList.add('is-open');
                }

                window.closeStoryViewer = () => {
                    document.getElementById(VIEWER_ID).classList.remove('is-open');
                    window.closeReplies(); // Close reply modal too
                    if(currentStoryTimer) clearTimeout(currentStoryTimer);
                    if(progressInterval) clearInterval(progressInterval); 
                    currentStoryData = null;
                    currentStoryGroupIndex = -1;
                }

                window.nextStory = () => {
                    if(!currentStoryData) return;
                    if(currentStoryIndex < currentStoryData.activities.length - 1) {
                        currentStoryIndex++;
                        renderStoryFrame(true);
                    } else {
                        // FEATURE: Auto-advance to next user
                        const nextUserIndex = currentStoryGroupIndex + 1;
                        if (nextUserIndex < allStoryGroups.length) {
                            window.openStoryViewer(nextUserIndex);
                        } else {
                            window.closeStoryViewer();
                        }
                    }
                }

                window.prevStory = () => {
                    if(!currentStoryData) return;
                    if(currentStoryIndex > 0) {
                        currentStoryIndex--;
                        renderStoryFrame(true);
                    } else {
                        // Go back to previous user
                        const prevUserIndex = currentStoryGroupIndex - 1;
                        if (prevUserIndex >= 0) {
                            window.openStoryViewer(prevUserIndex);
                            // Jump to the last story of the previous user
                            currentStoryIndex = allStoryGroups[prevUserIndex].activities.length - 1;
                            renderStoryFrame(false); // Render without animation, just update time
                        } else {
                            // Loop back to the start of the current user's stories if already at the first story
                            currentStoryIndex = 0;
                            renderStoryFrame(true);
                        }
                    }
                }

                function renderStoryFrame(shouldAnimate) {
                    const v = document.getElementById(VIEWER_ID);
                    if(!v || !currentStoryData) return;
                    
                    const act = currentStoryData.activities[currentStoryIndex];
                    const activityId = act.id; // CRITICAL: Get ID for listeners
                    
                    // Always close replies when changing frame
                    window.closeReplies(); 

                    v.querySelector('.sv-background').style.backgroundImage = \`url(\${act.coverImage || currentStoryData.profileImage})\`;
                    v.querySelector('.sv-avatar').src = currentStoryData.profileImage;
                    
                    // Combine username and time
                    const svMeta = v.querySelector('.sv-meta');
                    svMeta.innerHTML = \`
                        <span class="sv-username">\${currentStoryData.name}</span>
                        <span style="opacity: 0.6; font-weight: 400; font-size: 0.8rem;"> • \${act.timestamp}</span>
                    \`;
                    
                    // Render progress bars
                    const progressContainer = v.querySelector('.sv-progress-container');
                    progressContainer.innerHTML = Array.from({length: currentStoryData.activities.length}).map((_, i) => 
                        \`<div class="sv-progress-bar \${i < currentStoryIndex ? 'completed' : ''} \${i === currentStoryIndex ? 'active' : ''}"><div class="sv-progress-fill"></div></div>\`
                    ).join('');

                    const img = v.querySelector('.sv-card-img');
                    const tMain = v.querySelector('.sv-text-main');
                    const tSub = v.querySelector('.sv-text-sub');
                    const viewRepliesBtn = v.querySelector('#sv-view-replies-btn');

                    img.src = act.coverImage || 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/default.jpg';
                    tMain.innerText = act.textMain;
                    tSub.innerText = act.mediaTitle; // Use mediaTitle instead of textSub for accuracy

                    // Attach Listeners & Sync Button State 
                    const likeBtn = v.querySelector('#sv-like-btn');
                    const replyBtn = v.querySelector('#sv-reply-btn');
                    
                    if (likeBtn) {
                        const likeCountText = ' (' + act.likeCount + ')';
                        likeBtn.innerText = '❤️ ' + (act.isLiked ? 'Liked' : 'Like') + likeCountText;
                        likeBtn.classList.toggle('liked', act.isLiked);
                        likeBtn.onclick = () => window.likeActivity(activityId); // Attach listener with ID
                    }
                    
                    if (replyBtn) {
                        replyBtn.onclick = () => window.replyActivity(activityId); // Attach listener with ID
                    }

                    if (viewRepliesBtn) {
                        viewRepliesBtn.onclick = () => window.showReplies(activityId);
                    }
                    
                    if (shouldAnimate) {
                        [img, tMain, tSub].forEach(el => {
                            el.classList.remove('sv-animate-enter');
                            void el.offsetWidth;
                            el.classList.add('sv-animate-enter');
                        });
                        restartStoryTimer();
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
                                <div class="sv-meta"></div>
                                <button class="sv-close" aria-label="Close">&times;</button>
                            </div>
                            <div class="sv-body">
                                <div class="sv-nav-left" onclick="window.prevStory()"></div> 
                                <img class="sv-card-img" src="">
                                <div class="sv-nav-right" onclick="window.nextStory()"></div>
                            </div>
                            <div class="sv-footer">
                                <div class="sv-text-main"></div>
                                <div class="sv-text-sub"></div>
                                <div class="sv-actions">
                                    <button class="sv-action-btn" id="sv-like-btn">❤️ Like</button>
                                    <button class="sv-action-btn" id="sv-reply-btn">💬 Reply</button>
                                    <button class="sv-action-btn" id="sv-view-replies-btn">👁️ View Replies</button>
                                </div>
                            </div>
                            
                            <!-- REPLY MODAL -->
                            <div id="reply-modal">
                                <div class="reply-header">
                                    <h3>Activity Replies</h3>
                                    <button class="reply-close" aria-label="Close" onclick="window.closeReplies()">&times;</button>
                                </div>
                                <div class="reply-list" id="reply-list">
                                    <div class="reply-none">Loading replies...</div>
                                </div>
                            </div>
                            <!-- END REPLY MODAL -->
                        </div>
                    \`;
                    document.body.appendChild(v);
                    v.querySelector('.sv-close').onclick = window.closeStoryViewer;
                }

                // --- RENDER LOGIC ---
                function attachReloadListener() {
                    const reloadBtn = document.getElementById('reload-btn');
                    if (reloadBtn) reloadBtn.onclick = () => {
                        const tokenToUse = activeToken || INJECTED_TOKEN; 
                        if (tokenToUse) fetchActivities(tokenToUse, true);
                        else renderInputForm("Please enter your AniList Access Token.");
                    };
                }

                function ensureBox() {
                    const target = document.querySelector(TARGET_SEL);
                    if (!target) return false;
                    // Check if the box is already injected
                    if (document.getElementById(BOX_ID)) return true;
                    
                    const box = document.createElement('div');
                    box.id = BOX_ID;
                    // The style tag is now injected globally by fetchAndInjectStyles
                    box.innerHTML = '<div id="feed-content"></div>';
                    
                    // Prepend for toolbar/containers, insert after for bottom elements
                    if (TARGET_SEL.includes('toolbar') || TARGET_SEL.includes('container') || TARGET_SEL.includes('column-left') || TARGET_SEL.includes('lists-container')) {
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
                    content.innerHTML = \`
                        <div class="box-header">AniList Friend Activity</div>
                        <div class="token-form">
                            \${error ? \`<div class="error-msg">\${error}</div>\` : ''}
                            <input type="password" id="ani-token" class="token-input" placeholder="Paste AniList Access Token" />
                            <button id="ani-save-btn" class="token-btn">Load Activity Feed</button>
                            <div class="token-help">Create token at <a href="https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token" target="_blank">AniList API</a></div>
                        </div>
                    \`;

                    document.getElementById('ani-save-btn').onclick = () => {
                        const token = document.getElementById('ani-token').value.trim();
                        if (token) fetchActivities(token);
                    };
                }

                function renderLoading(fromCacheCheck = false) { 
                    const content = document.getElementById('feed-content');
                    if (!content) return;
                    const msg = fromCacheCheck ? 'Checking cache and fetching updates...' : 'Fetching updates...';
                    const spinner = \`<svg class="animate-spin" style="width:24px; height:24px; margin-right:10px;" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>\`;
                    const headerHtml = '<div class="box-header">Friend Activity <button class="action-btn" id="reload-btn" style="opacity:0.8">Reload</button></div>';
                    content.innerHTML = headerHtml + \`<div class="state-msg" style="display:flex; justify-content:center; align-items:center; flex-direction:column; padding-bottom: 16px;">\${spinner}\${msg}</div>\`;
                    attachReloadListener();
                }

                function renderStories(stories, fromCache = false) { 
                    const content = document.getElementById('feed-content');
                    if (!content) return;

                    allStoryGroups = stories;

                    const cacheIndicator = fromCache ? ' (Cached)' : '';
                    const reloadText = fromCache ? 'Refresh' : '↻ Reload';
                    const headerHtml = \`<div class="box-header">Friend Activity\${cacheIndicator} <button class="action-btn" id="reload-btn">\${reloadText}</button></div>\`;

                    if (stories.length === 0) {
                        content.innerHTML = headerHtml + '<div class="state-msg">No recent activity found.</div>';
                    } else {
                        const html = stories.map((s, index) => {
                            const ring = getSegmentedRingStyle(s.activities.length, s.status === 'new');
                            return \`
                            <div class="story-item" data-index="\${index}">
                                <div class="story-ring" style="\${ring}">
                                    <img src="\${s.profileImage}" class="story-image" onerror="this.src='https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png'">
                                </div>
                                <span class="story-name">\${s.name}</span>
                            </div>\`;
                        }).join('');
                        
                        content.innerHTML = headerHtml + '<div class="stories-container">' + html + '</div><div style="padding: 0 16px 16px 16px; min-height: 1px;"></div>';
                        
                        content.querySelectorAll('.story-item').forEach(item => {
                            item.onclick = () => {
                                const index = parseInt(item.getAttribute('data-index'));
                                window.openStoryViewer(index); // Use the global helper
                            };
                        });
                    }
                    attachReloadListener();
                }
                
                async function fetchActivities(token, forceRefresh = false) { 
                    activeToken = token;
                    if (!token) return renderInputForm("Token not found. Please provide your AniList Access Token.");
                    
                    renderLoading(!forceRefresh); 
                    
                    const cached = localStorage.getItem(CACHE_KEY);
                    if (!forceRefresh && cached) { 
                        try {
                            const data = JSON.parse(cached);
                            if (Date.now() < data.timestamp + CACHE_DURATION_MS) {
                                renderStories(data.stories, true);
                                return;
                            }
                        } catch (e) {
                            console.error("Failed to parse cache, proceeding with fetch.", e);
                            localStorage.removeItem(CACHE_KEY);
                        }
                    }
                    
                    // CORRECTED QUERY: isLiked and likeCount must be fields on ListActivity, NOT User.
                    const query = \`
                    query { 
                        Page(page: 1, perPage: 25) { 
                            activities(type: MEDIA_LIST, sort: ID_DESC, isFollowing: true) { 
                                ... on ListActivity { 
                                    id 
                                    media { 
                                        title { romaji english } 
                                        coverImage { extraLarge } 
                                    } 
                                    status 
                                    progress 
                                    createdAt 
                                    isLiked             
                                    likeCount           
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
                        const res = await fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + token },
                            body: JSON.stringify({ query: query })
                        });

                        const json = await res.json();
                        if (!res.ok || json.errors) throw new Error(json.errors ? json.errors[0].message : 'Invalid Token or Network Error');

                        const rawActs = json.data.Page.activities;
                        const grouped = {};
                        
                        rawActs.forEach(act => {
                            const uName = act.user.name;
                            if (!grouped[uName]) grouped[uName] = { name: uName, profileImage: act.user.avatar.medium, status: 'new', activities: [] };
                            
                            const title = act.media.title.english || act.media.title.romaji;
                            let textMain = "";

                            if (act.status.includes('watched episode')) textMain = 'Watched Episode ' + act.progress;
                            else if (act.status.includes('read chapter')) textMain = 'Read Chapter ' + act.progress;
                            else if (act.status.includes('completed')) textMain = 'Completed';
                            else if (act.status.includes('plans to watch')) textMain = 'Plans to watch';
                            else textMain = act.status;

                            grouped[uName].activities.push({
                                id: act.id,
                                textMain: textMain,
                                mediaTitle: title, // Storing title explicitly
                                timestamp: timeAgo(act.createdAt),
                                coverImage: act.media.coverImage.extraLarge,
                                isLiked: act.isLiked,
                                likeCount: act.likeCount,
                            });
                        });

                        const finalStories = Object.values(grouped);
                        finalStories.forEach(g => g.activities.reverse());

                        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), stories: finalStories }));
                        renderStories(finalStories, false);

                    } catch (e) {
                        console.error("API Fetch Failed:", e);
                        let errMsg = "Error: " + e.message;
                        
                        if (cached) {
                            try { renderStories(JSON.parse(cached).stories, true); errMsg = "API Error: Showing stale cached data. Try refreshing later."; } 
                            catch (cacheError) {}
                        }
                        renderInputForm(errMsg);
                    }
                }
            
                async function mainLoop() {
                    // Inject styles first by fetching the external file
                    await fetchAndInjectStyles();
                    
                    if (!ensureBox()) return setTimeout(mainLoop, 500);
                    if (INJECTED_TOKEN && INJECTED_TOKEN.trim() !== "") return fetchActivities(INJECTED_TOKEN, false);
                    renderInputForm();
                }
                mainLoop();
            })();
            `; 
            return jsString;
        }
  
        const handleContentBox = async (ctx: UiContext) => {  
            if (await ctx.dom.queryOne(`script[${SCRIPT_DATA_ATTR}]`)) return;

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
            
            const currentSettings = {
                activeTargetSelector: state.activeTargetSelector,
                bgStyle: state.bgStyle,
                ringColor: state.ringColor,
            };

            script.setText(getSmartInjectedScript(token, currentSettings));  
            
            const body = await ctx.dom.queryOne("body");
            if (body) body.append(script);
        };  
  
        const cleanupContentBox = async (ctx: UiContext) => {  
            const existingBox = await ctx.dom.queryOne('#' + INJECTED_BOX_ID);  
            if (existingBox) await existingBox.remove();  
              
            const existingViewer = await ctx.dom.queryOne(`#${VIEWER_ID}`);  
            if (existingViewer) await existingViewer.remove();  
  
            const existingStyles = await ctx.dom.queryOne(`#anilist-feed-styles`);  
            if (existingStyles) await existingStyles.remove();  
  
            const existingScripts = await ctx.dom.query(`script[${SCRIPT_DATA_ATTR}]`);  
            for (const script of existingScripts) await script.remove();  
        };  
  
        ctx.dom.onReady(async () => {  
            ctx.screen.onNavigate(async (e) => {  
                const isRoot = e.pathname === "/";  
                if (isRoot) {
                    await handleContentBox(ctx);
                } else {
                    await cleanupContentBox(ctx);
                }
            });  
            ctx.screen.loadCurrent();   
        });  
    });
}
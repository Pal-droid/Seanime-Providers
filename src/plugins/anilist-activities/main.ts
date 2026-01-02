/// <reference path="./core.d.ts" />

function init() {
    $ui.register((ctx) => {
        // --- CONSTANTS ---
        const INJECTED_BOX_ID = "activity-stories-feed";
        const VIEWER_ID = "story-viewer-overlay";
        const INPUT_MODAL_ID = "reply-input-modal";
        const SCRIPT_DATA_ATTR = "data-injected-box-script";
        const SEANIME_API_URL = 'http://localhost:43211/api/v1/status';
        const EXTERNAL_CSS_URL = "https://raw.githubusercontent.com/Pal-droid/Seanime-Providers/refs/heads/main/src/plugins/anilist-activities/styles.css";

        const SELECTOR_MAP: Record<string, string> = {
            'toolbar': 'div[data-home-toolbar-container="true"]',
            'bottom-page': 'div[data-home-screen-item-divider="true"]',
            'above-watching': 'div[data-library-collection-lists-container="true"]',
        };

        const STORAGE_KEYS: Record<string, string> = {
            DROPDOWN_CHOICE: "anilist-feed.dropdownChoice",
            MANUAL_OVERRIDE_SELECTOR: "anilist-feed.manualOverrideSelector",
            BG_STYLE: "anilist-feed.bgStyle",
            RING_COLOR: "anilist-feed.ringColor",
            REPLY_POSITION: "anilist-feed.replyPosition",
            LANGUAGE_CHOICE: "anilist-feed.languageChoice",
        };

        type SettingKey = keyof typeof STORAGE_KEYS;
        type SettingValue = string;

        const SETTING_DEFAULTS: Record<SettingKey, SettingValue> = {
            DROPDOWN_CHOICE: 'toolbar',
            MANUAL_OVERRIDE_SELECTOR: '',
            BG_STYLE: 'glass',
            RING_COLOR: '#FF6F61',
            REPLY_POSITION: 'right',
            LANGUAGE_CHOICE: 'en',
        };

        const settingsKeys: SettingKey[] = Object.keys(SETTING_DEFAULTS) as SettingKey[];
        const refs: Record<string, FieldRef<SettingValue>> = {};
        const state: Record<string, SettingValue> = {};

        settingsKeys.forEach((key) => {
            const storageKey = STORAGE_KEYS[key];
            const initialValue = $storage.get(storageKey) ?? SETTING_DEFAULTS[key];
            state[key] = initialValue;
            refs[key] = ctx.fieldRef(initialValue);
        });

        const resolveTargetSelector = (dropdownChoice: string, manualOverride: string): string => {
            return (manualOverride && manualOverride.trim() !== "")
                ? manualOverride.trim()
                : SELECTOR_MAP[dropdownChoice] || SELECTOR_MAP['toolbar'];
        };

        let activeTargetSelector = resolveTargetSelector(state.DROPDOWN_CHOICE, state.MANUAL_OVERRIDE_SELECTOR);

        ctx.registerEventHandler("save-feed-settings", () => {
            let newActiveSelector = activeTargetSelector;
            settingsKeys.forEach(key => {
                const newValue = refs[key].current;
                const storageKey = STORAGE_KEYS[key];
                $storage.set(storageKey, newValue);
                state[key] = newValue;
                if (key === 'DROPDOWN_CHOICE' || key === 'MANUAL_OVERRIDE_SELECTOR') {
                    newActiveSelector = resolveTargetSelector(state.DROPDOWN_CHOICE, state.MANUAL_OVERRIDE_SELECTOR);
                }
            });
            activeTargetSelector = newActiveSelector;
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
                    fieldRef: refs.DROPDOWN_CHOICE,
                    options: [
                        { label: "Default (Toolbar)", value: 'toolbar' },
                        { label: "Above Currently Watching", value: 'above-watching' },
                        { label: "Bottom of Page", value: 'bottom-page' },
                    ]
                }),
                tray.input("Manual Selector Override (CSS)", {
                    fieldRef: refs.MANUAL_OVERRIDE_SELECTOR,
                    placeholder: "e.g., .my-custom-div"
                }),
                tray.select("Background Style", {
                    fieldRef: refs.BG_STYLE,
                    options: [
                        { label: "Glass (Blur)", value: "glass" },
                        { label: "Solid Dark", value: "dark" },
                        { label: "Solid Light", value: "light" },
                        { label: "Transparent", value: "transparent" }
                    ]
                }),
                tray.select("Ring Color", {
                    fieldRef: refs.RING_COLOR,
                    options: [
                        { label: "Coral (Default)", value: "#FF6F61" },
                        { label: "AniList Blue", value: "#3DB4F2" },
                        { label: "Seanime Accent", value: 'seanime-dynamic' }
                    ]
                }),
                tray.select("Reply Modal Position", {
                    fieldRef: refs.REPLY_POSITION,
                    options: [
                        { label: "Right Side (Default)", value: "right" },
                        { label: "Left Side", value: "left" },
                    ]
                }),
                tray.select("Language", {
                    fieldRef: refs.LANGUAGE_CHOICE,
                    options: [
                        { label: "English (Default)", value: 'en' },
                        { label: "Italiano", value: 'it' }
                    ]
                }),
                tray.button("Save & Apply", {
                    onClick: "save-feed-settings",
                    intent: "primary-subtle"
                })
            ];
            return tray.stack({ items, style: { gap: "12px", padding: "8px" } });
        });

        // --- INJECTED SCRIPT GENERATOR ---

        function getDynamicStyles(bgStyle: string, ringColor: string): string {
            const IS_LIGHT = bgStyle === 'light';
            const MAIN_TEXT_COLOR = IS_LIGHT ? '#374151' : '#E5E7EB';
            const MASK_COLOR = IS_LIGHT ? '#ffffff' : '#1f2937';

            let bgCss = "";
            switch (bgStyle) {
                case "dark": bgCss = "background-color: #151f2e; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);"; break;
                case "light": bgCss = "background-color: #ffffff; color: #111; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);"; break;
                case "transparent": bgCss = "background-color: transparent; box-shadow: none;"; break;
                case "glass": default:
                    bgCss = "background-color: rgba(255, 255, 255, 0.05); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);";
                    break;
            }

            let ringOverride = "";
            if (ringColor === 'seanime-dynamic') {
                ringOverride = `.story-svg-ring > circle { stroke: rgb(var(--color-brand-500)) !important; }`;
            }

            return `
                #${INJECTED_BOX_ID} { ${bgCss} color: ${MAIN_TEXT_COLOR}; }
                .story-image { border: 5px solid ${MASK_COLOR} !important; }
                .story-name { color: ${MAIN_TEXT_COLOR}; }
                ${ringOverride}
            `;
        }

        const getSmartInjectedScript = (prefilledToken: string = '', settings: any): string => {
            const dynamicStyles = getDynamicStyles(settings.bgStyle, settings.ringColor);
            
            return `
            (function() {
                // --- INJECT EXTERNAL CSS ---
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = "${EXTERNAL_CSS_URL}";
                document.head.appendChild(link);

                // --- INJECT DYNAMIC OVERRIDES ---
                const styleSheet = document.createElement("style");
                styleSheet.innerText = \`${dynamicStyles}\`;
                document.head.appendChild(styleSheet);

                const T = {
                    en: {
                        feed_title: "AniList Friend Activity", reload_btn: "Reload", refresh_btn: "Refresh",
                        view_replies: "👁️ View Replies", reply_btn: "💬 Reply", post_reply: "Post a Reply",
                        cancel: "Cancel", post: "Post", no_replies: "No replies yet. Be the first!",
                        loading_replies: "Loading replies...", error_load_replies: "Failed to load replies.",
                        reply_success: "Reply posted successfully!", loading_accent: "Friend Activity (Loading Accent)",
                        loading_cache: "Checking cache and fetching updates...", fetching_updates: "Fetching updates...",
                        no_activity: "No recent activity found.", cached_stale: "Friend Activity (Cached/Stale)",
                        token_input_placeholder: "Paste AniList Access Token", token_load_btn: "Load Activity Feed",
                        token_help_text: "Create token at <a href='https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token' target='_blank'>AniList API</a>",
                        token_not_found: "Token not found. Please provide your AniList Access Token.",
                        api_error: "API Error: ",
                    },
                    it: {
                        feed_title: "Attività Amici AniList", reload_btn: "Ricarica", refresh_btn: "Aggiorna",
                        view_replies: "👁️ Visualizza Risposte", reply_btn: "💬 Rispondi", post_reply: "Invia Risposta",
                        cancel: "Annulla", post: "Invia", no_replies: "Nessuna risposta. Sii il primo!",
                        loading_replies: "Caricamento risposte...", error_load_replies: "Errore nel caricare le risposte.",
                        reply_success: "Risposta inviata con successo!", loading_accent: "Attività Amici (Caricamento Accento)",
                        loading_cache: "Controllo cache e recupero aggiornamenti...", fetching_updates: "Recupero aggiornamenti...",
                        no_activity: "Nessuna attività recente trovata.", cached_stale: "Attività Amici (Cached/Obsoleta)",
                        token_input_placeholder: "Incolla Token Accesso AniList", token_load_btn: "Carica Feed Attività",
                        token_help_text: "Crea token su <a href='https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token' target='_blank'>AniList API</a>",
                        token_not_found: "Token non trovato.",
                        api_error: "Errore API: ",
                    }
                };
                const langCode = '${settings.language}';
                const texts = T[langCode] || T.en;

                const BOX_ID = "${INJECTED_BOX_ID}";
                const VIEWER_ID = "${VIEWER_ID}";
                const INPUT_MODAL_ID = "${INPUT_MODAL_ID}";
                const TARGET_SEL = '${settings.activeTargetSelector}';
                const INJECTED_TOKEN = "${prefilledToken}";
                const RING_COLOR_SETTING = '${settings.ringColor}';
                const SEANIME_API_URL_LOCAL = '${SEANIME_API_URL}';
                const REPLY_POSITION = '${settings.replyPosition}';
                const BASE_REDIRECT_URL = 'http://localhost:43211';

                let DYNAMIC_RING_COLOR = RING_COLOR_SETTING === 'seanime-dynamic' ? '#FF6F61' : RING_COLOR_SETTING;
                let activeToken = null;
                let allStoryGroups = [];
                let currentStoryGroupIndex = -1;
                let currentStoryData = null;
                let currentStoryIndex = 0;
                let currentStoryTimer = null;
                let progressInterval = null;
                let isInteractionActive = false;
                let isHoldingCenter = false;

                function timeAgo(t) {
                    const s = Math.floor((new Date() - new Date(t * 1000)) / 1000);
                    if (s < 60) return "Just now";
                    if (s < 3600) return Math.floor(s/60) + "m ago";
                    if (s < 86400) return Math.floor(s/3600) + "h ago";
                    return Math.floor(s/86400) + "d ago";
                }

                function getStoryRingSVG(isNew) {
                    const COLOR = isNew ? DYNAMIC_RING_COLOR : '#334155';
                    const R = 37.5; const CIRC = 2 * Math.PI * R;
                    const dash = (CIRC / 6) * 0.8; const gap = (CIRC / 6) * 0.2;
                    return \`<svg class="story-svg-ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="\${R}" fill="none" stroke="\${COLOR}" stroke-width="5" stroke-dasharray="\${dash} \${gap}" stroke-linecap="round"/></svg>\`;
                }

                async function apiCall(query, variables) {
                    if (!activeToken) return null;
                    try {
                        const res = await fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + activeToken },
                            body: JSON.stringify({ query, variables })
                        });
                        return await res.json();
                    } catch (e) { return null; }
                }

                window.openReplyInputModal = (activityId) => {
                    isInteractionActive = true; pauseViewerTimer();
                    const m = document.getElementById(INPUT_MODAL_ID);
                    m.classList.add('is-open'); m.querySelector('textarea').focus();
                };

                window.closeReplyInputModal = () => {
                    document.getElementById(INPUT_MODAL_ID).classList.remove('is-open');
                    resumeViewerTimer();
                };

                window.showReplies = async (activityId) => {
                    isInteractionActive = true; pauseViewerTimer();
                    const m = document.getElementById('reply-modal');
                    m.classList.add('is-visible', REPLY_POSITION === 'right' ? 'slide-in-right' : 'slide-in-left');
                };

                window.closeReplies = () => {
                    const m = document.getElementById('reply-modal');
                    m.classList.remove('slide-in-right', 'slide-in-left');
                    m.classList.add(REPLY_POSITION === 'right' ? 'slide-out-right' : 'slide-out-left');
                    setTimeout(() => { m.classList.remove('is-visible'); resumeViewerTimer(); }, 300);
                };

                window.openStoryViewer = (idx) => {
                    allStoryGroups[idx] && (currentStoryGroupIndex = idx, currentStoryData = allStoryGroups[idx], currentStoryIndex = 0, renderStoryFrame(true), document.getElementById(VIEWER_ID).classList.add('is-open'));
                };

                window.closeStoryViewer = () => {
                    document.getElementById(VIEWER_ID).classList.remove('is-open');
                    clearTimeout(currentStoryTimer); clearInterval(progressInterval);
                    isInteractionActive = false;
                };

                window.nextStory = () => {
                    if (currentStoryIndex < currentStoryData.activities.length - 1) { currentStoryIndex++; renderStoryFrame(true); }
                    else if (currentStoryGroupIndex < allStoryGroups.length - 1) { window.openStoryViewer(currentStoryGroupIndex + 1); }
                    else { window.closeStoryViewer(); }
                };

                function pauseViewerTimer() { clearTimeout(currentStoryTimer); clearInterval(progressInterval); }
                function resumeViewerTimer() { if (!isInteractionActive) restartStoryTimer(); }

                function restartStoryTimer() {
                    pauseViewerTimer();
                    const fill = document.querySelector('.sv-progress-bar.active .sv-progress-fill');
                    if (!fill) return;
                    let start = Date.now();
                    currentStoryTimer = setTimeout(window.nextStory, 5000);
                    progressInterval = setInterval(() => {
                        fill.style.width = Math.min(100, ((Date.now() - start) / 5000) * 100) + '%';
                    }, 50);
                }

                function renderStoryFrame(anim) {
                    const act = currentStoryData.activities[currentStoryIndex];
                    const v = document.getElementById(VIEWER_ID);
                    v.querySelector('.sv-background').style.backgroundImage = \`url(\${act.coverImage})\`;
                    v.querySelector('.sv-avatar').src = currentStoryData.profileImage;
                    v.querySelector('.sv-card-img').src = act.coverImage;
                    v.querySelector('.sv-text-main').innerText = act.textMain;
                    v.querySelector('.sv-text-sub').innerText = act.mediaTitle;
                    
                    const redirect = v.querySelector('#sv-redirect-btn');
                    redirect.onclick = () => window.location.href = \`\${BASE_REDIRECT_URL}/entry?id=\${act.mediaId}\`;

                    const prog = v.querySelector('.sv-progress-container');
                    prog.innerHTML = currentStoryData.activities.map((_, i) => \`<div class="sv-progress-bar \${i<currentStoryIndex?'completed':''} \${i===currentStoryIndex?'active':''}"><div class="sv-progress-fill"></div></div>\`).join('');
                    
                    anim && restartStoryTimer();
                }

                async function fetchActivities(token) {
                    activeToken = token;
                    const res = await apiCall(\`query { Page { activities(type: MEDIA_LIST, isFollowing: true) { ... on ListActivity { id media { id title { english romaji } coverImage { extraLarge } } status progress createdAt user { name avatar { medium } } } } } }\`);
                    if (!res) return;
                    const grouped = {};
                    res.data.Page.activities.forEach(a => {
                        if (!grouped[a.user.name]) grouped[a.user.name] = { name: a.user.name, profileImage: a.user.avatar.medium, activities: [] };
                        grouped[a.user.name].activities.push({ id: a.id, textMain: a.status, mediaTitle: a.media.title.english || a.media.title.romaji, coverImage: a.media.coverImage.extraLarge, mediaId: a.media.id });
                    });
                    allStoryGroups = Object.values(grouped);
                    renderStories();
                }

                function renderStories() {
                    const container = document.getElementById('feed-content');
                    container.innerHTML = \`<div class="box-header">\${texts.feed_title}</div><div class="stories-container">\` + allStoryGroups.map((s, i) => \`
                        <div class="story-item" onclick="window.openStoryViewer(\${i})">
                            <div class="story-ring">\${getStoryRingSVG(true)}<img src="\${s.profileImage}" class="story-image"></div>
                            <span class="story-name">\${s.name}</span>
                        </div>\`).join('') + \`</div>\`;
                }

                async function main() {
                    const target = document.querySelector(TARGET_SEL);
                    if (!target) return setTimeout(main, 500);
                    const box = document.createElement('div');
                    box.id = BOX_ID; box.innerHTML = '<div id="feed-content"></div>';
                    target.prepend(box);

                    const v = document.createElement('div'); v.id = VIEWER_ID;
                    v.innerHTML = \`<div class="sv-background"></div><div class="sv-content"><div class="sv-progress-container"></div><div class="sv-header"><img class="sv-avatar"><div class="sv-meta"></div><button class="sv-close" onclick="window.closeStoryViewer()">&times;</button></div><div class="sv-body"><div class="sv-nav-left" onclick="window.prevStory()"></div><div class="sv-card-wrapper"><img class="sv-card-img"><button class="sv-redirect-btn" id="sv-redirect-btn">↗</button></div><div class="sv-nav-right" onclick="window.nextStory()"></div></div><div class="sv-footer"><div class="sv-text-main"></div><div class="sv-text-sub"></div><div class="sv-actions"><button class="sv-action-btn" onclick="window.openReplyInputModal()">\${texts.reply_btn}</button><button class="sv-action-btn" onclick="window.showReplies()">\${texts.view_replies}</button></div></div><div id="reply-modal" class="pos-\${REPLY_POSITION}"><div class="reply-header"><h3>Replies</h3><button onclick="window.closeReplies()">&times;</button></div><div class="reply-list"></div></div></div>\`;
                    document.body.appendChild(v);

                    const im = document.createElement('div'); im.id = INPUT_MODAL_ID;
                    im.innerHTML = \`<div class="input-modal-card"><h3>\${texts.post_reply}</h3><textarea class="reply-textarea"></textarea><div class="input-modal-footer"><button onclick="window.closeReplyInputModal()">Cancel</button><button onclick="window.closeReplyInputModal()">Post</button></div></div>\`;
                    document.body.appendChild(im);

                    INJECTED_TOKEN && fetchActivities(INJECTED_TOKEN);
                }
                main();
            })();
            `;
        }

        const handleContentBox = async (ctx: UiContext) => {
            if (await ctx.dom.queryOne(`script[${SCRIPT_DATA_ATTR}]`)) return;
            let token = "";
            try { 
                // @ts-ignore
                if (typeof $database !== 'undefined') token = await $database.anilist.getToken(); 
            } catch (e) {}

            const script = await ctx.dom.createElement("script");
            script.setAttribute(SCRIPT_DATA_ATTR, "true");
            // @ts-ignore
            script.setText(getSmartInjectedScript(token, {
                activeTargetSelector,
                bgStyle: state.BG_STYLE,
                ringColor: state.RING_COLOR,
                replyPosition: state.REPLY_POSITION,
                language: state.LANGUAGE_CHOICE
            }));
            const body = await ctx.dom.queryOne("body");
            if (body) body.append(script);
        };

        ctx.dom.onReady(async () => {
            ctx.screen.onNavigate(async (e) => {
                if (e.pathname === "/") await handleContentBox(ctx);
            });
            ctx.screen.loadCurrent();
        });
    });
}
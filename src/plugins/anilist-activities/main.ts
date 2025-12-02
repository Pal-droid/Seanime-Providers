/// <reference path="./core.d.ts" />

function init() {
    $ui.register((ctx) => {
        // --- CONSTANTS ---
        const INJECTED_BOX_ID = "activity-stories-feed";
        const VIEWER_ID = "story-viewer-overlay";
        const INPUT_MODAL_ID = "reply-input-modal";
        const SCRIPT_DATA_ATTR = "data-injected-box-script";
        const SEANIME_API_URL = 'http://localhost:43211/api/v1/status';
        const DEFAULT_CHOICE = 'toolbar';
        const DEFAULT_LANGUAGE = 'en';

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

        // --- STATE INITIALIZATION HELPER ---
        type SettingKey = keyof typeof STORAGE_KEYS;
        type SettingValue = string;

        const SETTING_DEFAULTS: Record<SettingKey, SettingValue> = {
            DROPDOWN_CHOICE: DEFAULT_CHOICE,
            MANUAL_OVERRIDE_SELECTOR: '',
            BG_STYLE: 'glass',
            RING_COLOR: '#FF6F61',
            REPLY_POSITION: 'right',
            LANGUAGE_CHOICE: DEFAULT_LANGUAGE,
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

        // Compute the active selector immediately
        const resolveTargetSelector = (dropdownChoice: string, manualOverride: string): string => {
            return (manualOverride && manualOverride.trim() !== "")
                ? manualOverride.trim()
                : SELECTOR_MAP[dropdownChoice] || SELECTOR_MAP[DEFAULT_CHOICE];
        };

        let activeTargetSelector = resolveTargetSelector(state.DROPDOWN_CHOICE, state.MANUAL_OVERRIDE_SELECTOR);
        // --- END STATE INITIALIZATION ---

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

            activeTargetSelector = newActiveSelector; // Update computed state
            ctx.toast.success("Settings saved! Refresh page to apply.");
        });

        // --- TRAY UI ---
        const tray = ctx.newTray({
            tooltipText: "Friend Activity Settings",
            iconUrl: "https://anilist.co/img/icons/android-chrome-512x512.png",
            withContent: true,
        });

        tray.render(() => {
            const seanimeOption = { label: "Seanime Accent", value: 'seanime-dynamic' };
            const seanimeHelpText = `Select this option to fetch the accent color from your local Seanime instance (${SEANIME_API_URL}) on page load.`;

            const ringColorOptions = [
                { label: "Coral (Default)", value: "#FF6F61" },
                { label: "AniList Blue", value: "#3DB4F2" },
                { label: "Emerald Green", value: "#10B981" },
                { label: "Violet", value: "#8B5CF6" },
                { label: "Hot Pink", value: "#EC4899" },
                { label: "Orange", value: "#F97316" },
                { label: "Red", "value": "#EF4444" },
                { label: "White", value: "#FFFFFF" },
                seanimeOption,
            ];

            const dropdownOptions = {
                DROPDOWN_CHOICE: [
                    { label: "Default (Toolbar)", value: 'toolbar' },
                    { label: "Above Currently Watching", value: 'above-watching' },
                    { label: "Bottom of Page", value: 'bottom-page' },
                ],
                BG_STYLE: [
                    { label: "Glass (Blur)", value: "glass" },
                    { label: "Solid Dark", value: "dark" },
                    { label: "Solid Light", value: "light" },
                    { label: "Transparent", value: "transparent" }
                ],
                REPLY_POSITION: [
                    { label: "Right Side (Default)", value: "right" },
                    { label: "Left Side", value: "left" },
                ],
                LANGUAGE_CHOICE: [
                    { label: "English (Default)", value: 'en' },
                    { label: "Italiano", value: 'it' },
                    { label: "Espanõl", value: 'es' },
                    { label: "Français", value: 'fr' },
                    { label: "Português", value: 'pt' },
                    { label: "Chinese (Mandarin)", value: 'zh' },
                    { label: "Deutsch", value: 'de' },
                ],
            };

            const items = [
                tray.text("Activity Feed Settings", { style: { fontWeight: "bold", fontSize: "14px", marginBottom: "8px" } }),
                tray.select("Injection Point", {
                    fieldRef: refs.DROPDOWN_CHOICE,
                    options: dropdownOptions.DROPDOWN_CHOICE,
                    help: "Choose a common location to inject the feed."
                }),
                tray.input("Manual Selector Override (CSS)", {
                    fieldRef: refs.MANUAL_OVERRIDE_SELECTOR,
                    placeholder: "e.g., .my-custom-div",
                    help: "If provided, this CSS selector overrides the dropdown choice above."
                }),
                tray.select("Background Style", {
                    fieldRef: refs.BG_STYLE,
                    options: dropdownOptions.BG_STYLE
                }),
                tray.select("Ring Color", {
                    fieldRef: refs.RING_COLOR,
                    options: ringColorOptions,
                    help: seanimeHelpText
                }),
                tray.select("Reply Modal Position", {
                    fieldRef: refs.REPLY_POSITION,
                    options: dropdownOptions.REPLY_POSITION,
                    help: "Choose where the 'View Replies' modal slides in from."
                }),
                tray.select("Language", {
                    fieldRef: refs.LANGUAGE_CHOICE,
                    options: dropdownOptions.LANGUAGE_CHOICE,
                    help: "Select the language for the feed UI text."
                }),
                tray.button("Save & Apply", {
                    onClick: "save-feed-settings",
                    intent: "primary-subtle"
                })
            ];
            return tray.stack({ items, style: { gap: "12px", padding: "8px" } });
        });

        // --- INJECTED SCRIPT GENERATOR ---

        function getBaseStyles(bgStyle: string): string {
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

            return `
                /* FEED STYLES */
                #${INJECTED_BOX_ID} {
                    z-index: 20; position: relative; box-sizing: border-box; width: 100%; max-width: 1300px; margin: 16px auto 24px auto;
                    ${bgCss}
                    padding: 0; border-radius: 12px; font-family: "Inter", sans-serif; animation: slideInDown 0.4s ease-out;
                    color: ${MAIN_TEXT_COLOR}; min-height: 120px; display: flex; flex-direction: column; justify-content: center;
                }
                .box-header { margin-bottom: 12px; font-weight: 600; font-size: 1rem; display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 0 16px; }
                .action-btn { font-size: 0.75rem; color: #9CA3AF; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 12px; transition: all 0.2s; }
                .action-btn:hover { background: rgba(255,255,255,0.15); color: white; border-color: rgba(255,255,255,0.3); }

                /* BASE STYLES - Mobile First */
                .stories-container { display: flex; overflow-x: auto; gap: 20px; padding: 0 16px 5px 16px; scrollbar-width: none; }
                .stories-container::-webkit-scrollbar { display: none; }
                .story-item { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; max-width: 65px; transition: transform 0.2s; }
                .story-ring {
                    width: 64px !important; height: 64px !important; padding: 0; border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; margin-bottom: 8px; transition: transform 0.2s; border: none; position: relative;
                }
                .story-svg-ring {
                    position: absolute; top: 0; left: 0; transform: rotate(-90deg); transform-origin: center center; width: 100% !important; height: 100% !important;
                }
                .story-image {
                    width: 54px !important; height: 54px !important; border-radius: 50%; object-fit: cover;
                    border: 5px solid ${MASK_COLOR} !important;
                    z-index: 1;
                }
                .story-name { font-size: 0.75rem; font-weight: 500; color: ${MAIN_TEXT_COLOR}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }

                /* DESKTOP / LARGE SCREEN */
                @media (min-width: 768px) {
                    .stories-container {
                        gap: 30px; padding: 0 24px 5px 24px; scrollbar-width: thin; scrollbar-color: #6B7280 #1F2937;
                    }
                    .stories-container::-webkit-scrollbar { height: 8px; display: block; }
                    .stories-container::-webkit-scrollbar-track { background: rgba(31, 41, 55, 0.5); border-radius: 10px; }
                    .stories-container::-webkit-scrollbar-thumb { background-color: rgba(107, 114, 128, 0.7); border-radius: 10px; border: 2px solid transparent; }
                    .story-item { max-width: 80px; }
                    .story-ring { width: 80px !important; height: 80px !important; margin-bottom: 10px; }
                    .story-svg-ring { transform: rotate(-90deg); }
                    .story-image { width: 70px !important; height: 70px !important; border: 5px solid ${MASK_COLOR} !important; }
                    .story-name { font-size: 0.85rem; }
                    #${INJECTED_BOX_ID} { padding-top: 24px; padding-bottom: 24px; }
                    .box-header { padding: 0 24px 0 24px; }
                }

                .token-form { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 10px; padding: 0 16px 16px 16px;}
                .token-input { background: rgba(0,0,0,0.3); border: 1px solid #4B5563; color: white; padding: 8px 12px; border-radius: 6px; width: 80%; max-width: 300px; font-size: 0.9rem; }
                .token-input:focus { outline: none; border-color: #3DB4F2; box-shadow: 0 0 0 1px #3DB4F2; }
                .token-btn { background: #6366F1; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
                .token-btn:hover { background: #4F46E5; }
                .token-help { font-size: 0.8rem; color: #9CA3AF; text-align: center; }
                .token-help a { color: #8B5CF6; text-decoration: underline; }
                .state-msg { text-align: center; color: #9CA3AF; width: 100%; padding: 0 16px 16px 16px; }
                .error-msg { color: #F87171; margin-bottom: 8px; font-size: 0.9rem; }

                /* VIEWER STYLES */
                #${VIEWER_ID} { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 9999; display: none; flex-direction: column; user-select: none; }
                #${VIEWER_ID}.is-open { display: flex; animation: fadeIn 0.2s; }
                
                .sv-background { 
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; 
                    transition: background-image 0.5s ease; will-change: filter, background-image; 
                    filter: blur(40px) brightness(0.7); /* ADDED */
                    transform: scale(1.05); /* ADDED: To cover blur edges */
                }

                .sv-content { position: relative; z-index: 2; width: 100%; height: 100%; display: flex; flex-direction: column; }
                .sv-progress-container { display: flex; gap: 4px; padding: 12px 10px; width: 100%; box-sizing: border-box; }
                .sv-progress-bar { flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; }
                .sv-progress-fill { height: 100%; background: #fff; width: 0%; transition: width 0.1s linear; }
                .sv-progress-bar.completed .sv-progress-fill { width: 100%; }
                .sv-header { display: flex; align-items: center; padding: 0 16px; margin-top: 4px; height: 50px; }
                .sv-avatar { width: 32px; height: 32px; border-radius: 50%; margin-right: 10px; border: 1px solid rgba(255,255,255,0.2); }
                .sv-username { color: white; font-weight: 600; font-size: 0.9rem; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
                .sv-close { margin-left: auto; color: white; background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 5px; opacity: 0.8; }
                .sv-body { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; }

                .sv-card-wrapper { position: relative; width: 85%; max-height: 60vh; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .sv-card-img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }

                .sv-redirect-btn {
                    position: absolute; top: 10px; right: 10px; 
                    z-index: 1000; 
                    background: rgba(0, 0, 0, 0.4); border: none; color: white;
                    padding: 8px; border-radius: 8px; cursor: pointer; transition: opacity 0.2s;
                    font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
                    opacity: 1; /* Always visible on mobile */
                }
                .sv-redirect-btn:hover { background: rgba(0, 0, 0, 0.6); }

                .sv-footer { padding: 20px; padding-bottom: 40px; color: white; text-align: center; }
                .sv-text-main { font-size: 1.1rem; font-weight: 600; margin-bottom: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); }
                .sv-text-sub { font-size: 0.9rem; font-weight: 400; margin-bottom: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.8); }
                .sv-nav-left, .sv-nav-right { position: absolute; top: 0; bottom: 0; z-index: 100; cursor: pointer; background: transparent; }
                .sv-nav-left:active, .sv-nav-right:active { background: rgba(255,255,255,0.05); }
                .sv-nav-left { left: 0; width: 30%; }
                .sv-nav-right { right: 0; width: 70%; }
                .sv-animate-enter { animation: fadeInScale 0.3s ease-out; }
                @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .sv-actions { margin-top: 15px; display: flex; justify-content: center; gap: 15px; }
                .sv-action-btn { background: rgba(255, 255, 255, 0.15); border: none; padding: 8px 15px; border-radius: 8px; color: white; cursor: pointer; transition: background 0.2s; font-weight: 500; font-size: 0.9rem; }
                .sv-action-btn:hover { background: rgba(255, 255, 255, 0.25); }

                /* VIEWER FOR PC */
                @media (min-width: 1024px) {
                    .sv-body { padding-top: 20px; }
                    .sv-card-wrapper { width: auto; max-width: 600px; max-height: 70vh; }
                    .sv-nav-left { width: 15%; }
                    .sv-nav-right { width: 15%; }

                    /* Desktop - Hide button by default, show on wrapper hover */
                    .sv-redirect-btn { opacity: 0; z-index: 1000; } /* Keep high z-index even when hidden */
                    .sv-card-wrapper:hover .sv-redirect-btn { opacity: 1; }
                }
                
                @media (max-width: 767px) {
                    /* Push the navigation zones below the header and above the footer */
                    .sv-nav-left, .sv-nav-right {
                        top: 60px;    /* Start 60px from the top (clears header/redirect button) */
                        bottom: 60px; /* End 60px from the bottom (clears footer) */
                        height: auto;
                    }
                    
                    .sv-nav-right {
                        /* Keep the width restrictive to the right side of the main card */
                        width: 40%;
                    }
                    .sv-nav-left {
                        width: 30%;
                    }
                    
                    /* Ensure the redirect button is slightly larger for easier tapping and remains positioned correctly */
                    .sv-redirect-btn {
                        width: 36px;
                        height: 36px;
                        padding: 6px;
                        font-size: 1.2rem;
                        top: 10px;
                        right: 10px;
                        opacity: 1;
                        z-index: 1000; /* Redundant but safe */
                    }
                }


                /* REPLY MODAL ANIMATIONS & STYLES */
                @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
                @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
                @keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
                .slide-in-right { animation: slideInRight 0.3s ease-out forwards; }
                .slide-out-right { animation: slideOutRight 0.3s ease-in forwards; }
                .slide-in-left { animation: slideInLeft 0.3s ease-out forwards; }
                .slide-out-left { animation: slideOutLeft 0.3s ease-in forwards; }

                #reply-modal { position: absolute; top: 0; width: 100%; max-width: 400px; height: 100%; background: rgba(0,0,0,0.95); z-index: 10; display: none; flex-direction: column; padding: 10px; box-sizing: border-box; }
                #reply-modal.is-visible { display: flex; }
                #reply-modal.pos-right { right: 0; left: auto; }
                #reply-modal.pos-left { left: 0; right: auto; }
                @media (max-width: 768px) { #reply-modal { max-width: 100%; left: 0 !important; right: 0 !important; } }

                .reply-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
                .reply-header h3 { color: white; margin: 0; font-size: 1.1rem; }
                .reply-close { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
                .reply-list { flex-grow: 1; overflow-y: auto; padding: 10px 0; }
                .reply-item { display: flex; gap: 10px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .reply-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
                .reply-body { flex-grow: 1; text-align: left; }
                .reply-meta { font-size: 0.8rem; color: #9CA3AF; margin-bottom: 4px; }
                .reply-meta span { font-weight: 600; color: white; margin-right: 5px; }
                .reply-text { color: white; font-size: 0.9rem; line-height: 1.4; }
                .reply-none { color: #9CA3AF; text-align: center; padding: 20px; }

                /* REPLY INPUT MODAL STYLES */
                #${INPUT_MODAL_ID} { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: none; justify-content: center; align-items: center; animation: fadeIn 0.2s; }
                #${INPUT_MODAL_ID}.is-open { display: flex; }
                .input-modal-card { background: #151f2e; border-radius: 12px; width: 90%; max-width: 450px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: white; display: flex; flex-direction: column; gap: 15px; }
                .input-modal-card h3 { margin: 0; font-size: 1.2rem; font-weight: 700; color: #3DB4F2; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
                .reply-textarea { width: 100%; min-height: 100px; padding: 10px; border: 1px solid #4B5563; border-radius: 8px; background: #1F2937; color: white; font-size: 1rem; resize: vertical; box-sizing: border-box; }
                .reply-textarea:focus { outline: none; border-color: #3DB4F2; box-shadow: 0 0 0 1px #3DB4F2; }
                .input-modal-footer { display: flex; justify-content: space-between; align-items: center; }
                .char-count { font-size: 0.8rem; color: #9CA3AF; }
                .char-count.error { color: #EF4444; font-weight: 600; }
                .input-modal-actions button { padding: 8px 15px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .input-modal-actions .cancel-btn { background: transparent; border: 1px solid #4B5563; color: #9CA3AF; margin-right: 10px; }
                .input-modal-actions .cancel-btn:hover { background: rgba(75, 85, 99, 0.1); }
                .input-modal-actions .submit-btn { background: #3DB4F2; border: none; color: white; }
                .input-modal-actions .submit-btn:hover { background: #2A9DD8; }
                .input-modal-actions .submit-btn:disabled { background: #374151; cursor: not-allowed; }
            `;
        }


        const getSmartInjectedScript = (prefilledToken: string = '', settings: {
            activeTargetSelector: string,
            bgStyle: string,
            ringColor: string,
            replyPosition: string,
            language: string, 
        }): string => {
            const styles = getBaseStyles(settings.bgStyle);
            const IS_LIGHT = settings.bgStyle === 'light';
            const LANG = settings.language; 

            // injected js script
            const jsString = `
            (function() {
                const styles = \`${styles.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`;

                // --- TRANSLATION DATA ---
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
                        api_error: "API Error: ", processing_error: "Data Processing Failed: Check console for structure errors.",
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
                        token_not_found: "Token non trovato. Fornisci il tuo Token di Accesso AniList.",
                        api_error: "Errore API: ", processing_error: "Elaborazione Dati Fallita: Controlla la console per errori di struttura.",
                    },
                    es: {
                        feed_title: "Actividad de Amigos AniList", reload_btn: "Recargar", refresh_btn: "Actualizar",
                        view_replies: "👁️ Ver Respuestas", reply_btn: "💬 Responder", post_reply: "Publicar Respuesta",
                        cancel: "Cancelar", post: "Publicar", no_replies: "No hay respuestas. ¡Sé el primero!",
                        loading_replies: "Cargando respuestas...", error_load_replies: "Error al cargar las respuestas.",
                        reply_success: "¡Respuesta publicada con éxito!", loading_accent: "Actividad Amigos (Cargando Acento)",
                        loading_cache: "Comprobando caché y buscando actualizaciones...", fetching_updates: "Buscando actualizaciones...",
                        no_activity: "No se encontró actividad reciente.", cached_stale: "Actividad Amigos (Caché/Antigua)",
                        token_input_placeholder: "Pegar Token de Acceso a AniList", token_load_btn: "Cargar Feed de Actividad",
                        token_help_text: "Crear token en <a href='https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token' target='_blank'>AniList API</a>",
                        token_not_found: "Token no encontrado. Proporciona tu Token de Acceso a AniList.",
                        api_error: "Error de API: ", processing_error: "Error de Procesamiento de Datos: Comprueba la consola por errores de estructura.",
                    },
                    fr: {
                        feed_title: "Activité d'Amis AniList", reload_btn: "Recharger", refresh_btn: "Actualiser",
                        view_replies: "👁️ Voir Réponses", reply_btn: "💬 Répondre", post_reply: "Poster une Réponse",
                        cancel: "Annuler", post: "Poster", no_replies: "Aucune réponse. Soyez le premier!",
                        loading_replies: "Chargement des réponses...", error_load_replies: "Échec du chargement des réponses.",
                        reply_success: "Réponse postée avec succès!", loading_accent: "Activité Amis (Chargement Accent)",
                        loading_cache: "Vérification du cache et récupération des mises à jour...", fetching_updates: "Récupération des mises à jour...",
                        no_activity: "Aucune activité récente trouvée.", cached_stale: "Activité Amis (Cache/Périmée)",
                        token_input_placeholder: "Coller le Jeton d'Accès AniList", token_load_btn: "Charger le Fil d'Activité",
                        token_help_text: "Créer un jeton sur <a href='https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token' target='_blank'>AniList API</a>",
                        token_not_found: "Jeton non trouvé. Veuillez fournir votre Jeton d'Accès AniList.",
                        api_error: "Erreur API : ", processing_error: "Échec du Traitement des Données : Vérifiez la console pour les erreurs de structure.",
                    },
                    pt: {
                        feed_title: "Atividade de Amigos AniList", reload_btn: "Recarregar", refresh_btn: "Atualizar",
                        view_replies: "👁️ Ver Respostas", reply_btn: "💬 Responder", post_reply: "Publicar Resposta",
                        cancel: "Cancelar", post: "Publicar", no_replies: "Nenhuma resposta. Seja o primeiro!",
                        loading_replies: "Carregando respostas...", error_load_replies: "Falha ao carregar respostas.",
                        reply_success: "Resposta publicada com sucesso!", loading_accent: "Atividade Amigos (Carregando Destaque)",
                        loading_cache: "Verificando cache e buscando atualizações...", fetching_updates: "Buscando atualizações...",
                        no_activity: "Nenhuma atividade recente encontrada.", cached_stale: "Atividade Amigos (Cache/Desatualizada)",
                        token_input_placeholder: "Cole Token de Acesso AniList", token_load_btn: "Carregar Feed de Atividade",
                        token_help_text: "Crie o token em <a href='https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token' target='_blank'>AniList API</a>",
                        token_not_found: "Token não encontrado. Forneça seu Token de Acesso AniList.",
                        api_error: "Erro de API: ", processing_error: "Falha no Processamento de Dados: Verifique o console para erros de estrutura.",
                    },
                    zh: {
                        feed_title: "AniList 朋友动态", reload_btn: "重新加载", refresh_btn: "刷新",
                        view_replies: "👁️ 查看回复", reply_btn: "💬 回复", post_reply: "发布回复",
                        cancel: "取消", post: "发布", no_replies: "暂无回复，成为第一个吧!",
                        loading_replies: "正在加载回复...", error_load_replies: "加载回复失败。",
                        reply_success: "回复发布成功!", loading_accent: "朋友动态 (加载强调色)",
                        loading_cache: "检查缓存并获取更新...", fetching_updates: "正在获取更新...",
                        no_activity: "未找到近期动态。", cached_stale: "朋友动态 (缓存/过期)",
                        token_input_placeholder: "粘贴 AniList 访问令牌", token_load_btn: "加载动态信息流",
                        token_help_text: "在 <a href='https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token' target='_blank'>AniList API</a> 创建令牌",
                        token_not_found: "未找到令牌。请提供您的 AniList 访问令牌。",
                        api_error: "API 错误: ", processing_error: "数据处理失败: 检查控制台是否存在结构错误。",
                    },
                    de: {
                        feed_title: "AniList Freunde-Aktivität", reload_btn: "Neu laden", refresh_btn: "Aktualisieren",
                        view_replies: "👁️ Antworten anzeigen", reply_btn: "💬 Antworten", post_reply: "Antwort posten",
                        cancel: "Abbrechen", post: "Posten", no_replies: "Noch keine Antworten. Sei der Erste!",
                        loading_replies: "Antworten werden geladen...", error_load_replies: "Fehler beim Laden der Antworten.",
                        reply_success: "Antwort erfolgreich gepostet!", loading_accent: "Freunde-Aktivität (Akzent wird geladen)",
                        loading_cache: "Cache wird geprüft und Aktualisierungen werden abgerufen...", fetching_updates: "Aktualisierungen werden abgerufen...",
                        no_activity: "Keine kürzliche Aktivität gefunden.", cached_stale: "Freunde-Aktivität (Cache/Veraltet)",
                        token_input_placeholder: "AniList-Zugriffstoken einfügen", token_load_btn: "Aktivitäts-Feed laden",
                        token_help_text: "Token unter <a href='https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token' target='_blank'>AniList API</a> erstellen",
                        token_not_found: "Token nicht gefunden. Bitte geben Sie Ihr AniList-Zugriffstoken an.",
                        api_error: "API-Fehler: ", processing_error: "Datenverarbeitung fehlgeschlagen: Überprüfen Sie die Konsole auf Strukturfehler.",
                    }
                };
                const langCode = '${LANG}';
                const texts = T[langCode] || T.en;

                const BOX_ID = "${INJECTED_BOX_ID}";
                const VIEWER_ID = "${VIEWER_ID}";
                const INPUT_MODAL_ID = "${INPUT_MODAL_ID}";
                const TARGET_SEL = '${settings.activeTargetSelector}';
                const INJECTED_TOKEN = "${prefilledToken.replace(/"/g, '\\"')}";
                const RING_COLOR_SETTING = '${settings.ringColor}';
                const SEANIME_API_URL_LOCAL = '${SEANIME_API_URL}';
                const REPLY_POSITION = '${settings.replyPosition}';

                // Core constants
                const CACHE_KEY = "anilist-feed-cache";
                const CACHE_DURATION_MS = 300000;
                const STORY_DURATION = 5000;
                const FALLBACK_RING_COLOR = '#FF6F61';
                const MAX_REPLY_CHARS = 140;
                const SVG_SIZE = 80;
                const STROKE_WIDTH = 5;
                const KB_CLOSE = 'Escape';
                const KB_NEXT = 'ArrowRight';
                const KB_PREV = 'ArrowLeft';
                const BASE_REDIRECT_URL = 'http://localhost:43211'; // Requested base URL

                let DYNAMIC_RING_COLOR = RING_COLOR_SETTING === 'seanime-dynamic' ? FALLBACK_RING_COLOR : RING_COLOR_SETTING;
                let IS_DYNAMIC_COLOR_LOADING = RING_COLOR_SETTING === 'seanime-dynamic';

                let activeToken = null;
                let allStoryGroups = [];
                let currentStoryGroupIndex = -1;
                let currentStoryData = null;
                let currentStoryIndex = 0;
                let currentStoryTimer = null;
                let progressInterval = null;
                let startTime = 0;
                let currentActivityIdForReply = null;
                let isInteractionActive = false;
                let isHoldingCenter = false;

                // --- UTILITIES ---
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

                function getStoryRingSVG(isNew) {
                    const COLOR = isNew ? DYNAMIC_RING_COLOR : '#334155';
                    const R = (SVG_SIZE / 2) - (STROKE_WIDTH / 2);
                    const CIRCUMFERENCE = 2 * Math.PI * R;
                    const SEGMENT_COUNT = 6;
                    const GAP_RATIO = 0.2;
                    const totalSegmentLength = CIRCUMFERENCE / SEGMENT_COUNT;
                    const colorLength = totalSegmentLength * (1 - GAP_RATIO);
                    const gapLength = totalSegmentLength * GAP_RATIO;
                    const dashArray = \`\${colorLength.toFixed(2)} \${gapLength.toFixed(2)}\`;

                    return \`
                        <svg class="story-svg-ring" viewBox="0 0 \${SVG_SIZE} \${SVG_SIZE}" style="z-index: 0;">
                            <circle
                                cx="\${SVG_SIZE / 2}"
                                cy="\${SVG_SIZE / 2}"
                                r="\${R}"
                                fill="none"
                                stroke="\${COLOR}"
                                stroke-width="\${STROKE_WIDTH}"
                                stroke-dasharray="\${dashArray}"
                                stroke-linecap="round"
                            />
                        </svg>
                    \`;
                }

                // --- API & DATA LOGIC ---

                async function resolveDynamicRingColor() {
                    if (RING_COLOR_SETTING !== 'seanime-dynamic') {
                        IS_DYNAMIC_COLOR_LOADING = false;
                        return;
                    }

                    const maxRetries = 3;
                    let lastError = '';

                    for (let i = 0; i < maxRetries; i++) {
                        try {
                            const response = await fetch(SEANIME_API_URL_LOCAL, {
                                method: 'GET',
                                headers: { 'Content-Type': 'application/json' },
                                signal: AbortSignal.timeout(2000),
                            });

                            if (response.ok) {
                                const json = await response.json();
                                const accentColor = json.themeSettings?.accentColor || FALLBACK_RING_COLOR;
                                DYNAMIC_RING_COLOR = accentColor;
                                console.log(\`[AniList Feed] Fetched dynamic Seanime color: \${accentColor}\`);
                                IS_DYNAMIC_COLOR_LOADING = false;
                                return;
                            } else {
                                lastError = \`HTTP Error: \${response.status}\`;
                            }
                        } catch (e) {
                            lastError = e.name === 'TimeoutError' ? 'Connection Timeout' : e.message || 'Network Error';
                        }

                        if (i < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                        }
                    }

                    DYNAMIC_RING_COLOR = FALLBACK_RING_COLOR;
                    IS_DYNAMIC_COLOR_LOADING = false;
                    console.error(\`[AniList Feed] Failed to connect to Seanime after \${maxRetries} tries (Last Error: \${lastError}). Using fallback color \${FALLBACK_RING_COLOR}.\`);
                }

                async function apiCall(query, variables) {
                    if (!activeToken) {
                        console.error("AniList API call failed: No active token found in memory.");
                        return null;
                    }

                    let res;
                    try {
                        res = await fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + activeToken },
                            body: JSON.stringify({ query, variables })
                        });

                        if (!res.ok) {
                            console.error(\`AniList API Fetch Error: HTTP \${res.status} (\${res.statusText})\`);
                            throw new Error(\`HTTP \${res.status} Error fetching data.\`);
                        }

                        const json = await res.json();

                        if (json.errors) {
                            const errorMsg = json.errors[0].message;
                            console.error(\`AniList GraphQL Error: \${errorMsg}\`, json.errors);
                            throw new Error(errorMsg);
                        }

                        return json;
                    } catch (e) {
                        const errorText = e.message || 'Unknown Network/Fetch Error';
                        console.error('AniList API Call Failed:', errorText);

                        const box = document.getElementById(BOX_ID);
                        if (box) {
                            const msg = document.createElement('div');
                            msg.innerText = texts.api_error + errorText + '. Check console for details.';
                            msg.style.cssText = 'color: #F87171; text-align: center; padding: 10px; background: rgba(248, 113, 113, 0.1); border-radius: 8px; margin: 10px;';
                            box.prepend(msg);
                            setTimeout(() => msg.remove(), 7000);
                        }
                        return null;
                    }
                }

                // --- TIMER CONTROL LOGIC ---

                function pauseViewerTimer() {
                    if (currentStoryTimer) clearTimeout(currentStoryTimer);
                    if (progressInterval) clearInterval(progressInterval);

                    const activeBar = document.querySelector('.sv-progress-bar.active');
                    if (activeBar) {
                         const fill = activeBar.querySelector('.sv-progress-fill');
                         if (fill) fill.style.transition = 'none';
                    }
                    isInteractionActive = true;
                }

                function resumeViewerTimer() {
                    const viewerOpen = document.getElementById(VIEWER_ID)?.classList.contains('is-open');
                    const replyModalVisible = document.getElementById('reply-modal')?.classList.contains('is-visible');
                    const inputModalOpen = document.getElementById(INPUT_MODAL_ID)?.classList.contains('is-open');

                    if (replyModalVisible || inputModalOpen || isHoldingCenter) {
                        isInteractionActive = true;
                        return;
                    }

                    isInteractionActive = false;

                    if (viewerOpen && currentStoryData) {
                        const activeBar = document.querySelector('.sv-progress-bar.active');
                        if (activeBar) {
                            const fill = activeBar.querySelector('.sv-progress-fill');
                            if (fill) fill.style.transition = 'width 0.1s linear';
                        }

                        restartStoryTimer();
                    }
                }

                function restartStoryTimer() {
                    if (isInteractionActive) return;

                    if (currentStoryTimer) clearTimeout(currentStoryTimer);
                    if (progressInterval) clearInterval(progressInterval);
                    startTime = Date.now();

                    const activeBar = document.querySelector('.sv-progress-bar.active');
                    if (!activeBar) return;

                    const fill = activeBar.querySelector('.sv-progress-fill');
                    if (fill) {
                        fill.style.transition = 'width 0.1s linear';
                        fill.style.width = '0%';
                    }

                    currentStoryTimer = setTimeout(window.nextStory, STORY_DURATION);
                    progressInterval = setInterval(() => {
                        const percent = Math.min(100, ((Date.now() - startTime) / STORY_DURATION) * 100);
                        if (fill) fill.style.width = percent + '%';
                        if (percent >= 100) clearInterval(progressInterval);
                    }, 100);
                }

                // --- HOLD/TAP PAUSE LOGIC ---
                const handleHoldStart = (e) => {
                    if (e.button === 2) return;

                    // Do not pause if clicking directly on an action button
                    if (e.target.closest('.sv-actions') || e.target.closest('#sv-redirect-btn')) return;

                    const isReplyModalVisible = document.getElementById('reply-modal')?.classList.contains('is-visible');
                    const isInputModalOpen = document.getElementById(INPUT_MODAL_ID)?.classList.contains('is-open');
                    if (isReplyModalVisible || isInputModalOpen) return;

                    isHoldingCenter = true;
                    pauseViewerTimer();
                    const body = document.querySelector(\`#\${VIEWER_ID} .sv-body\`);
                    if (body) body.style.cursor = 'grabbing';
                };

                const handleHoldEnd = () => {
                    if (!isHoldingCenter) return;

                    isHoldingCenter = false;
                    const body = document.querySelector(\`#\${VIEWER_ID} .sv-body\`);
                    if (body) body.style.cursor = '';

                    setTimeout(resumeViewerTimer, 50);
                };

                function attachHoldListeners() {
                    const v = document.getElementById(VIEWER_ID);
                    if (!v) return;

                    v.addEventListener('mousedown', handleHoldStart);
                    v.addEventListener('mouseup', handleHoldEnd);
                    v.addEventListener('mouseleave', handleHoldEnd);

                    v.addEventListener('touchstart', handleHoldStart, { passive: true });
                    v.addEventListener('touchend', handleHoldEnd);
                    v.addEventListener('touchcancel', handleHoldEnd);
                }

                function removeHoldListeners() {
                    const v = document.getElementById(VIEWER_ID);
                    if (!v) return;

                    v.removeEventListener('mousedown', handleHoldStart);
                    v.removeEventListener('mouseup', handleHoldEnd);
                    v.removeEventListener('mouseleave', handleHoldEnd);

                    v.removeEventListener('touchstart', handleHoldStart);
                    v.removeEventListener('touchend', handleHoldEnd);
                    v.removeEventListener('touchcancel', handleHoldEnd);
                }
                // --- END HOLD/TAP PAUSE LOGIC ---


                // --- WINDOW FUNCTIONS ---

                window.goToMediaEntry = (mediaId, mediaType) => {
                    if (!mediaId || !mediaType) return;
                    const isManga = mediaType === 'MANGA';
                    const path = isManga ? '/manga/entry?id=' : '/entry?id=';
                    
                    // FIX: Changed from window.open(..., '_blank') to window.location.href for redirection in the current tab
                    window.location.href = BASE_REDIRECT_URL + path + mediaId; 
                }

                window.openReplyInputModal = (activityId) => {
                    currentActivityIdForReply = activityId;
                    const modal = document.getElementById(INPUT_MODAL_ID);
                    const textarea = document.getElementById('reply-textarea');
                    const countSpan = document.getElementById('char-count-span');
                    const submitBtn = document.getElementById('reply-submit-btn');

                    if (!modal || !textarea || !countSpan || !submitBtn) return;

                    isInteractionActive = true;
                    pauseViewerTimer();

                    textarea.value = '';
                    countSpan.innerText = \`0/\${MAX_REPLY_CHARS}\`;
                    countSpan.classList.remove('error');
                    submitBtn.disabled = true;

                    modal.classList.add('is-open');
                    textarea.focus();
                }

                window.closeReplyInputModal = () => {
                    document.getElementById(INPUT_MODAL_ID)?.classList.remove('is-open');
                    currentActivityIdForReply = null;

                    resumeViewerTimer();
                }

                window.handleReplyInput = (textarea) => {
                    const countSpan = document.getElementById('char-count-span');
                    const submitBtn = document.getElementById('reply-submit-btn');
                    const charCount = textarea.value.length;

                    if (!countSpan || !submitBtn) return;

                    countSpan.innerText = \`\${charCount}/\${MAX_REPLY_CHARS}\`;

                    if (charCount > MAX_REPLY_CHARS || charCount === 0) {
                        countSpan.classList.add('error');
                        submitBtn.disabled = true;
                    } else {
                        countSpan.classList.remove('error');
                        submitBtn.disabled = false;
                    }
                }

                window.submitReply = async () => {
                    const activityId = currentActivityIdForReply;
                    const textarea = document.getElementById('reply-textarea');
                    const replyText = textarea?.value?.trim();

                    if (!replyText || replyText.length === 0 || replyText.length > MAX_REPLY_CHARS || !activityId) return;

                    const REPLY_MUTATION = 'mutation ($activityId: Int, $text: String) { SaveActivityReply(activityId: $activityId, text: $text) { id } }';
                    const submitBtn = document.getElementById('reply-submit-btn');

                    if (submitBtn) submitBtn.disabled = true;

                    const result = await apiCall(REPLY_MUTATION, { activityId: activityId, text: replyText });

                    if (result) {
                        window.closeReplyInputModal();

                        const successMsg = document.createElement('div');
                        successMsg.innerText = texts.reply_success;
                        successMsg.style.cssText = 'position:absolute; top:20px; left:50%; transform:translateX(-50%); background:#10B981; color:white; padding:8px 15px; border-radius:8px; font-weight:600; z-index: 10002;';
                        document.getElementById(INPUT_MODAL_ID).appendChild(successMsg);
                        setTimeout(() => {
                            successMsg.remove();
                            resumeViewerTimer();
                        }, 1500);

                    } else {
                        if (submitBtn) submitBtn.disabled = false;
                    }
                }

                window.replyActivity = (id) => {
                    window.openReplyInputModal(id);
                }

                window.showReplies = async (activityId) => {
                    const replyModal = document.getElementById('reply-modal');
                    const replyList = document.getElementById('reply-list');
                    if (!replyModal || !replyList) return;

                    isInteractionActive = true;
                    pauseViewerTimer();

                    replyModal.classList.add('is-visible');

                    replyModal.classList.remove('slide-out-right', 'slide-out-left');

                    const animClass = (REPLY_POSITION === 'right') ? 'slide-in-right' : 'slide-in-left';
                    replyModal.classList.add(animClass);

                    replyList.innerHTML = \`<div class="reply-none">\${texts.loading_replies}</div>\`;

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
                            replyList.innerHTML = \`<div class="reply-none">\${texts.no_replies}</div>\`;
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
                        replyList.innerHTML = \`<div class="reply-none">\${texts.error_load_replies}</div>\`;
                    }
                }

                window.closeReplies = () => {
                    const replyModal = document.getElementById('reply-modal');
                    if (!replyModal) return;

                    replyModal.classList.remove('slide-in-right', 'slide-in-left');

                    const animClass = (REPLY_POSITION === 'right') ? 'slide-out-right' : 'slide-out-left';
                    replyModal.classList.add(animClass);

                    setTimeout(() => {
                        replyModal.classList.remove('is-visible', 'slide-out-right', 'slide-out-left');
                        resumeViewerTimer();
                    }, 280);
                }

                function handleKeyDown(e) {
                    const viewer = document.getElementById(VIEWER_ID);
                    const replyModal = document.getElementById('reply-modal');
                    const inputModal = document.getElementById(INPUT_MODAL_ID);

                    const isViewerOpen = viewer && viewer.classList.contains('is-open');
                    const isReplyModalVisible = replyModal && replyModal.classList.contains('is-visible');
                    const isInputModalOpen = inputModal && inputModal.classList.contains('is-open');

                    if (!isViewerOpen) return;

                    if (e.key === KB_CLOSE) {
                        if (isInputModalOpen) {
                            window.closeReplyInputModal();
                        } else if (isReplyModalVisible) {
                            window.closeReplies();
                        } else {
                            window.closeStoryViewer();
                        }
                        e.preventDefault();
                    } else if (isReplyModalVisible || isInputModalOpen) {
                         return;
                    } else if (e.key === KB_NEXT) {
                        window.nextStory();
                        e.preventDefault();
                    } else if (e.key === KB_PREV) {
                        window.prevStory();
                        e.preventDefault();
                    }
                }

                window.openStoryViewer = (storyGroupIndex) => {
                    const storyGroup = allStoryGroups[storyGroupIndex];
                    if (!storyGroup) return;

                    currentStoryData = storyGroup;
                    currentStoryGroupIndex = storyGroupIndex;
                    currentStoryIndex = 0;

                    renderStoryFrame(true);
                    document.getElementById(VIEWER_ID).classList.add('is-open');

                    attachHoldListeners();
                    document.addEventListener('keydown', handleKeyDown);
                }

                window.closeStoryViewer = () => {
                    document.getElementById(VIEWER_ID).classList.remove('is-open');
                    window.closeReplies();
                    window.closeReplyInputModal();

                    if(currentStoryTimer) clearTimeout(currentStoryTimer);
                    if(progressInterval) clearInterval(progressInterval);

                    currentStoryData = null;
                    currentStoryGroupIndex = -1;
                    isInteractionActive = false;
                    isHoldingCenter = false;

                    removeHoldListeners();
                    document.removeEventListener('keydown', handleKeyDown);
                }

                window.nextStory = () => {
                    if(!currentStoryData) return;
                    if(currentStoryIndex < currentStoryData.activities.length - 1) {
                        currentStoryIndex++;
                        renderStoryFrame(true);
                    } else {
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
                        const prevUserIndex = currentStoryGroupIndex - 1;
                        if (prevUserIndex >= 0) {
                            document.getElementById(VIEWER_ID).classList.remove('is-open');

                            currentStoryGroupIndex = prevUserIndex;
                            currentStoryData = allStoryGroups[prevUserIndex];
                            currentStoryIndex = currentStoryData.activities.length - 1;

                            document.getElementById(VIEWER_ID).classList.add('is-open');
                            renderStoryFrame(true);
                        } else {
                            currentStoryIndex = 0;
                            renderStoryFrame(true);
                        }
                    }
                }

                function renderStoryFrame(shouldAnimate) {
                    const v = document.getElementById(VIEWER_ID);
                    if(!v || !currentStoryData) return;

                    const act = currentStoryData.activities[currentStoryIndex];
                    const activityId = act.id;
                    const mediaId = act.mediaId;
                    const mediaType = act.mediaType;


                    const replyModal = document.getElementById('reply-modal');
                    if (replyModal) replyModal.classList.remove('is-visible', 'slide-in-right', 'slide-out-right', 'slide-in-left', 'slide-out-left');
                    window.closeReplyInputModal();

                    v.querySelector('.sv-background').style.backgroundImage = \`url(\${act.coverImage || currentStoryData.profileImage})\`;
                    v.querySelector('.sv-avatar').src = currentStoryData.profileImage;

                    const svMeta = v.querySelector('.sv-meta');
                    svMeta.innerHTML = \`
                        <span class="sv-username">\${currentStoryData.name}</span>
                        <span style="opacity: 0.6; font-weight: 400; font-size: 0.8rem;"> • \${act.timestamp}</span>
                    \`;

                    const progressContainer = v.querySelector('.sv-progress-container');
                    progressContainer.innerHTML = Array.from({length: currentStoryData.activities.length}).map((_, i) =>
                        \`<div class="sv-progress-bar \${i < currentStoryIndex ? 'completed' : ''} \${i === currentStoryIndex ? 'active' : ''}"><div class="sv-progress-fill"></div></div>\`
                    ).join('');

                    const img = v.querySelector('.sv-card-img');
                    const tMain = v.querySelector('.sv-text-main');
                    const tSub = v.querySelector('.sv-text-sub');
                    const viewRepliesBtn = v.querySelector('#sv-view-replies-btn');
                    const replyBtn = v.querySelector('#sv-reply-btn');
                    const redirectBtn = v.querySelector('#sv-redirect-btn');

                    img.src = act.coverImage || 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/default.jpg';
                    tMain.innerText = act.textMain;
                    tSub.innerText = act.mediaTitle;

                    if (replyBtn) replyBtn.onclick = () => window.replyActivity(activityId);
                    if (viewRepliesBtn) viewRepliesBtn.onclick = () => window.showReplies(activityId);
                    if (viewRepliesBtn) viewRepliesBtn.innerText = texts.view_replies;
                    if (replyBtn) replyBtn.innerText = texts.reply_btn;

                    if (redirectBtn) {
                        redirectBtn.onclick = (e) => {
                            e.stopPropagation(); // Prevent the body click handler (pause) from firing
                            window.goToMediaEntry(mediaId, mediaType);
                        };
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
                                <button class="sv-close" aria-label="Close" onclick="window.closeStoryViewer()">&times;</button>
                            </div>
                            <div class="sv-body">
                                <div class="sv-nav-left" onclick="window.prevStory()"></div>
                                <div class="sv-card-wrapper" id="sv-card-wrapper">
                                    <img class="sv-card-img" src="">
                                    <button class="sv-redirect-btn" id="sv-redirect-btn" title="Go to Entry">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </button>
                                </div>
                                <div class="sv-nav-right" onclick="window.nextStory()"></div>
                            </div>
                            <div class="sv-footer">
                                <div class="sv-text-main"></div>
                                <div class="sv-text-sub"></div>
                                <div class="sv-actions">
                                    <button class="sv-action-btn" id="sv-reply-btn">\${texts.reply_btn}</button>
                                    <button class="sv-action-btn" id="sv-view-replies-btn">\${texts.view_replies}</button>
                                </div>
                            </div>

                            <div id="reply-modal" class="pos-\${REPLY_POSITION}">
                                <div class="reply-header">
                                    <h3>\${texts.view_replies.replace('👁️ ', '')}</h3>
                                    <button class="reply-close" aria-label="Close" onclick="window.closeReplies()">&times;</button>
                                </div>
                                <div class="reply-list" id="reply-list">
                                    <div class="reply-none">\${texts.loading_replies}</div>
                                </div>
                            </div>
                        </div>
                    \`;

                    const inputModal = document.createElement('div');
                    inputModal.id = INPUT_MODAL_ID;
                    inputModal.innerHTML = \`
                        <div class="input-modal-card">
                            <h3>\${texts.post_reply}</h3>
                            <textarea id="reply-textarea" class="reply-textarea" placeholder="Type your reply here..." oninput="window.handleReplyInput(this)"></textarea>
                            <div class="input-modal-footer">
                                <span class="char-count" id="char-count-span">0/\${MAX_REPLY_CHARS}</span>
                                <div class="input-modal-actions">
                                    <button class="cancel-btn" onclick="window.closeReplyInputModal()">\${texts.cancel}</button>
                                    <button class="submit-btn" id="reply-submit-btn" onclick="window.submitReply()" disabled>\${texts.post}</button>
                                </div>
                            </div>
                        </div>
                    \`;

                    document.body.appendChild(v);
                    document.body.appendChild(inputModal);
                    v.querySelector('.sv-close').onclick = window.closeStoryViewer;
                }

                function attachReloadListener() {
                    const reloadBtn = document.getElementById('reload-btn');
                    if (reloadBtn) reloadBtn.onclick = () => {
                        const tokenToUse = activeToken || INJECTED_TOKEN;
                        if (tokenToUse) fetchActivities(tokenToUse, true);
                        else renderInputForm(texts.token_not_found);
                    };
                }

                function ensureBox() {
                    const target = document.querySelector(TARGET_SEL);
                    if (!target) return false;
                    if (document.getElementById(BOX_ID)) return true;

                    const box = document.createElement('div');
                    box.id = BOX_ID;
                    box.innerHTML = '<style>' + styles + '</style><div id="feed-content"></div>';

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
                        <div class="box-header">\${texts.feed_title}</div>
                        <div class="token-form">
                            \${error ? \`<div class="error-msg">\${error}</div>\` : ''}
                            <input type="password" id="ani-token" class="token-input" placeholder="\${texts.token_input_placeholder}" />
                            <button id="ani-save-btn" class="token-btn">\${texts.token_load_btn}</button>
                            <div class="token-help">\${texts.token_help_text}</div>
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
                    const msg = fromCacheCheck ? texts.loading_cache : texts.fetching_updates;
                    const spinner = \`<svg class="animate-spin" style="width:24px; height:24px; margin-right:10px;" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>\`;
                    let headerText = texts.feed_title;
                    if (IS_DYNAMIC_COLOR_LOADING) {
                        headerText = texts.loading_accent;
                    }
                    const headerHtml = \`<div class="box-header">\${headerText} <button class="action-btn" id="reload-btn" style="opacity:0.8">\${texts.reload_btn}</button></div>\`;
                    content.innerHTML = headerHtml + \`<div class="state-msg" style="display:flex; justify-content:center; align-items:center; flex-direction:column; padding-bottom: 16px;">\${spinner}\${msg}</div>\`;
                    attachReloadListener();
                }

                function renderStories(stories, fromCache = false) {
                    const content = document.getElementById('feed-content');
                    if (!content) return;

                    allStoryGroups = stories;

                    const cacheIndicator = fromCache ? ' (Cached)' : '';
                    const reloadText = fromCache ? texts.refresh_btn : '↻ ' + texts.reload_btn;
                    let headerText = texts.feed_title;
                    if (IS_DYNAMIC_COLOR_LOADING) {
                        headerText = texts.loading_accent;
                    }
                    const headerHtml = \`<div class="box-header">\${headerText}\${cacheIndicator} <button class="action-btn" id="reload-btn">\${reloadText}</button></div>\`;

                    if (stories.length === 0) {
                        content.innerHTML = headerHtml + \`<div class="state-msg">\${texts.no_activity}</div>\`;
                    } else {
                        const html = stories.map((s, index) => {
                            const svgMarkup = getStoryRingSVG(s.status === 'new');

                            return \`
                            <div class="story-item" data-index="\${index}">
                                <div class="story-ring">
                                    \${svgMarkup}
                                    <img src="\${s.profileImage}" class="story-image" onerror="this.src='https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png'">
                                </div>
                                <span class="story-name">\${s.name}</span>
                            </div>\`;
                        }).join('');

                        content.innerHTML = headerHtml + '<div class="stories-container">' + html + '</div><div style="padding: 0 16px 16px 16px; min-height: 1px;"></div>';

                        content.querySelectorAll('.story-item').forEach(item => {
                            item.onclick = () => {
                                const index = parseInt(item.getAttribute('data-index'));
                                window.openStoryViewer(index);
                            };
                        });
                    }
                    attachReloadListener();
                }

                async function fetchActivities(token, forceRefresh = false) {
                    activeToken = token;
                    if (!token) return renderInputForm(texts.token_not_found);

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

                    const query = \`
                    query {
                        Page(page: 1, perPage: 50) {
                            activities(type: MEDIA_LIST, sort: ID_DESC, isFollowing: true) {
                                ... on ListActivity {
                                    id
                                    media {
                                        id # NEW
                                        type # NEW (ANIME or MANGA)
                                        title { romaji english }
                                        coverImage { extraLarge }
                                    }
                                    status
                                    progress
                                    createdAt
                                    user {
                                        name
                                        avatar { medium }
                                    }
                                }
                            }
                        }
                    }
                    \`;

                    const result = await apiCall(query, {});

                    if (result) {
                        try {
                            const rawActs = result.data.Page.activities;
                            const grouped = {};

                            rawActs.forEach(act => {
                                const uName = act.user.name;
                                if (!act.media) return; // Skip activities without associated media

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
                                    mediaTitle: title,
                                    timestamp: timeAgo(act.createdAt),
                                    coverImage: act.media.coverImage.extraLarge,
                                    mediaId: act.media.id,
                                    mediaType: act.media.type, 
                                });
                            });

                            const finalStories = Object.values(grouped);
                            finalStories.forEach(g => g.activities.reverse());

                            localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), stories: finalStories }));
                            renderStories(finalStories, false);

                        } catch (e) {
                            console.error("Data Processing Failed:", e);
                            renderInputForm(texts.processing_error);
                        }
                    } else {
                        if (cached) {
                            try {
                                renderStories(JSON.parse(cached).stories, true);

                                const content = document.getElementById('feed-content');
                                if (content) {
                                    const header = content.querySelector('.box-header');
                                    if (header) {
                                        header.innerHTML = texts.cached_stale + \` <button class="action-btn" id="reload-btn">\${texts.refresh_btn}</button>\`;
                                    }
                                    attachReloadListener();
                                }
                            }
                            catch (cacheError) {}
                        }
                    }
                }

                async function mainLoop() {
                    await resolveDynamicRingColor();

                    if (!ensureBox()) return setTimeout(mainLoop, 500);

                    const token = INJECTED_TOKEN.trim();
                    if (token === "") {
                        console.log("[AniList Feed Auth Check] Injected Token Status: Empty String (Not set by external system).");
                    } else if (token.toLowerCase() === "null") {
                        console.log("[AniList Feed Auth Check] Injected Token Status: String 'null' (Error reading from storage).");
                    } else if (token.length < 50) {
                        console.log(\`[AniList Feed Auth Check] Injected Token Status: Found, but short (\${token.length} chars). Possible issue.\`);
                    } else {
                        console.log(\`[AniList Feed Auth Check] Injected Token Status: Token Found, \${token.length} chars.\`);
                    }

                    if (token !== "") return fetchActivities(token, false);
                    renderInputForm();
                }
                mainLoop();
            })();
            `;
            return jsString;
        }

        // --- LIFECYCLE HOOKS ---

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

            const currentSettings = {
                activeTargetSelector: activeTargetSelector,
                bgStyle: state.BG_STYLE,
                ringColor: state.RING_COLOR,
                replyPosition: state.REPLY_POSITION,
                language: state.LANGUAGE_CHOICE, 
            };

            const script = await ctx.dom.createElement("script");
            script.setAttribute(SCRIPT_DATA_ATTR, "true");

            // @ts-ignore
            script.setText(getSmartInjectedScript(token, currentSettings));

            const body = await ctx.dom.queryOne("body");
            if (body) body.append(script);
        };

        const cleanupContentBox = async (ctx: UiContext) => {
            const elementsToRemove = [
                '#' + INJECTED_BOX_ID,
                '#' + VIEWER_ID,
                '#' + INPUT_MODAL_ID,
            ];
            for (const selector of elementsToRemove) {
                const existing = await ctx.dom.queryOne(selector);
                if (existing) await existing.remove();
            }

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

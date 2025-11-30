/// <reference path="./core.d.ts" />  

function init() {  
    $ui.register((ctx) => {  
        console.log("[injected-activity-feed] Initializing...");  
  
        // --- CONSTANTS ---  
        const INJECTED_BOX_ID = "activity-stories-feed";  
        const MODAL_ID = "story-modal-overlay";  
        const INJECTED_BOX_SELECTOR = `#${INJECTED_BOX_ID}`;  
        const TARGET_SELECTOR = '[data-home-toolbar-container="true"]';  
        const SCRIPT_DATA_ATTR = "data-injected-box-script";  
          
        // ---------------------------------------------------------------------------  
        // INJECTED SCRIPT GENERATOR  
        // ---------------------------------------------------------------------------  
  
        /** * Generates the self-contained JavaScript.
         * 
         */  
        function getSmartInjectedScript(prefilledToken: string = ''): string {  
            let script = '(function() {\n';  
            
            // --- CONSTANTS ---
            script += 'const BOX_ID = "'+INJECTED_BOX_ID+'";\n';  
            script += 'const MODAL_ID = "'+MODAL_ID+'";\n';  
            script += 'const TARGET_SEL = \''+TARGET_SELECTOR+'\'; \n';  
            // Inject the token from the host context safely
            script += 'const INJECTED_TOKEN = "'+ prefilledToken.replace(/"/g, '\\"') +'";\n';
            
            // --- CSS STYLES ---
            const cssStyles = `
                #${INJECTED_BOX_ID} { 
                    z-index: 20; position: relative; margin: 16px 16px 24px 16px; 
                    background-color: rgba(255, 255, 255, 0.05); 
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); 
                    padding: 16px; border-radius: 12px; 
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); 
                    border: 1px solid rgba(255, 255, 255, 0.1); 
                    font-family: "Inter", sans-serif; 
                    animation: slideInDown 0.4s ease-out; color: white; 
                    min-height: 120px; display: flex; flex-direction: column; justify-content: center;
                }
                .box-header { margin-bottom: 12px; font-weight: 600; font-size: 1rem; display: flex; justify-content: space-between; align-items: center; }
                .reset-btn { font-size: 0.7rem; color: #9CA3AF; cursor: pointer; text-decoration: underline; background: none; border: none; }
                .stories-container { display: flex; overflow-x: auto; gap: 20px; padding-bottom: 5px; scrollbar-width: none; }
                .stories-container::-webkit-scrollbar { display: none; }
                
                .story-item { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; max-width: 65px; }
                .story-ring { width: 64px; height: 64px; padding: 3px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; transition: border-color 0.3s; }
                .story-image { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid #1F2937; }
                .story-name { font-size: 0.75rem; font-weight: 500; color: #E5E7EB; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }

                .token-form { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 10px; }
                .token-input { background: rgba(0,0,0,0.3); border: 1px solid #4B5563; color: white; padding: 8px 12px; border-radius: 6px; width: 80%; max-width: 300px; font-size: 0.9rem; }
                .token-btn { background: #6366F1; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
                .token-btn:hover { background: #4F46E5; }
                .token-help { font-size: 0.75rem; color: #9CA3AF; margin-top: 5px; }
                .token-help a { color: #818CF8; text-decoration: none; }

                .state-msg { text-align: center; color: #9CA3AF; width: 100%; }
                .error-msg { color: #F87171; margin-bottom: 8px; font-size: 0.9rem; }
                
                #${MODAL_ID} { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; display: none; justify-content: center; align-items: center; }
                #${MODAL_ID}.is-open { display: flex; animation: fadeIn 0.2s; }
                .modal-dialog { background: #1E293B; border-radius: 12px; width: 90%; max-width: 400px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; position: relative; padding: 20px; }
                .modal-close { position: absolute; top: 10px; right: 15px; background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }
                .modal-list { list-style: none; padding: 0; margin: 15px 0 0 0; overflow-y: auto; }
                .modal-item { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #6366F1; }
                .modal-time { font-size: 0.7rem; color: #94A3B8; display: block; margin-top: 4px; text-align: right; }
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
                const colorNew = '#FF6F61'; const colorBg = '#334155'; const sep = '#1F2937';
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

            function renderModal(story) {
                let m = document.getElementById(MODAL_ID);
                if (!m) {
                    m = document.createElement('div'); m.id = MODAL_ID;
                    m.innerHTML = '<div class="modal-dialog"><button class="modal-close">&times;</button><div id="m-content"></div></div>';
                    document.body.appendChild(m);
                    m.querySelector('.modal-close').onclick = () => m.classList.remove('is-open');
                    m.onclick = (e) => { if(e.target === m) m.classList.remove('is-open'); };
                }
                
                const listHtml = story.activities.map(a => 
                    '<li class="modal-item"><div>' + a.content + '</div><span class="modal-time">' + a.timestamp + '</span></li>'
                ).join('');

                const contentHtml = 
                    '<div style="display:flex; align-items:center; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">' +
                        '<img src="' + story.profileImage + '" style="width:50px; height:50px; border-radius:50%; margin-right:15px;">' +
                        '<div><h3 style="margin:0; font-size:1.2rem;">' + story.name + '</h3><span style="font-size:0.8rem; color:#888;">' + story.activities.length + ' updates</span></div>' +
                    '</div>' +
                    '<ul class="modal-list">' + listHtml + '</ul>';

                document.getElementById('m-content').innerHTML = contentHtml;
                m.classList.add('is-open');
            }

            function ensureBox() {
                const target = document.querySelector(TARGET_SEL);
                if (!target) return false;
                if (document.getElementById(BOX_ID)) return true;
                
                const box = document.createElement('div');
                box.id = BOX_ID;
                box.innerHTML = '<style>' + styles + '</style><div id="feed-content"></div>';
                target.insertAdjacentElement('afterend', box);
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
                        // Directly use the token, do NOT save to localStorage
                        fetchActivities(token);
                    }
                };
            }

            function renderLoading() {
                const content = document.getElementById('feed-content');
                if (!content) return;
                content.innerHTML = '<div class="state-msg"><svg class="animate-spin" style="width:24px; height:24px; margin-right:10px;" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Fetching updates...</div>';
            }

            function renderStories(stories) {
                const content = document.getElementById('feed-content');
                if (!content) return;

                if (stories.length === 0) {
                    content.innerHTML = '<div class="box-header">Friend Activity <button class="reset-btn" id="reset-token">Change Token</button></div><div class="state-msg">No recent activity found.</div>';
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
                    
                    content.innerHTML = '<div class="box-header">Friend Activity <button class="reset-btn" id="reset-token">Reset</button></div><div class="stories-container">' + html + '</div>';
                    
                    content.querySelectorAll('.story-item').forEach(item => {
                        item.onclick = () => {
                            const name = item.getAttribute('data-id');
                            const story = stories.find(s => s.name === name);
                            if(story) renderModal(story);
                        };
                    });
                }

                document.getElementById('reset-token').onclick = () => {
                    // Just return to input form, no storage to clear
                    renderInputForm();
                };
            }
            `;

            // --- API FETCH LOGIC ---
            script += `
            async function fetchActivities(token) {
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
                        
                        let text = act.status;
                        const title = act.media.title.english || act.media.title.romaji;
                        if (act.status.includes('watched episode')) text = 'Watched Ep ' + act.progress + ' of ' + title;
                        else if (act.status.includes('read chapter')) text = 'Read Ch ' + act.progress + ' of ' + title;
                        else if (act.status.includes('completed')) text = 'Completed ' + title;
                        else text = act.status + ' ' + title;

                        grouped[uName].activities.push({
                            content: text,
                            timestamp: timeAgo(act.createdAt)
                        });
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
                
                // Priority 1: Injected Token (from Host)
                if (INJECTED_TOKEN && INJECTED_TOKEN !== "null" && INJECTED_TOKEN !== "undefined" && INJECTED_TOKEN.trim() !== "") {
                    fetchActivities(INJECTED_TOKEN);
                    return;
                }

                // Default: Manual Input (No storage check)
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

            // Attempt to fetch the token from the host environment
            let token = "";
            try {
                // @ts-ignore
                if (typeof $database !== 'undefined' && $database.anilist) {
                    // @ts-ignore
                    token = await $database.anilist.getToken();
                    console.log(`[injected-activity-feed] Token retrieved from host: ${token ? 'YES' : 'NO'}`);
                }
            } catch (e) {
                console.warn("[injected-activity-feed] Could not retrieve internal token:", e);
            }

            const script = await ctx.dom.createElement("script");  
            script.setAttribute(SCRIPT_DATA_ATTR, "true");  
            
            // Pass the token (or empty string) to the generator
            script.setText(getSmartInjectedScript(token));  
            
            const body = await ctx.dom.queryOne("body");
            if (body) body.append(script);
        };  
  
        const cleanupContentBox = async (ctx: UiContext) => {  
            const existingBox = await ctx.dom.queryOne(INJECTED_BOX_SELECTOR);  
            if (existingBox) await existingBox.remove();  
              
            const existingModal = await ctx.dom.queryOne(`#${MODAL_ID}`);  
            if (existingModal) await existingModal.remove();  
  
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

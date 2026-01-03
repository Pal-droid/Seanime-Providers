/**
 * Seanime Snow effect Plugin
 */

function init() {
    console.log('Snow Effect Plugin: Initializing...');
    
    $ui.register(async (ctx) => {
        console.log('UI Context registered');
        
        ctx.dom.onReady(async () => {
            console.log('DOM ready, injecting snow script...');
            
            try {
                // Create and inject the snow script
                const snowScript = await ctx.dom.createElement("script");
                await snowScript.setText(`
                    // Snow Animation for Seanime
                    (function() {
                        console.log('Injecting snow effect...');
                        
                        // Load saved state
                        let snowEnabled = true;
                        try {
                            const saved = localStorage.getItem('seanime-snow-enabled');
                            if (saved !== null) snowEnabled = saved === 'true';
                        } catch(e) {}
                        
                        // --- Detection State Variables --- (Moved to top)
                        let isInAnimePlayer = false;
                        let isInMangaReader = false;
                        let animePlayerObserver = null;
                        let mangaObserver = null;
                        let glowInterval = null;
                        
                        // Create snow container
                        const snowContainer = document.createElement('div');
                        snowContainer.id = 'premium-snow-container';
                        snowContainer.style.cssText = \`
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            pointer-events: none;
                            z-index: 9997;
                            overflow: hidden;
                            transition: opacity 0.5s ease-in-out;
                            opacity: \${snowEnabled ? '1' : '0'};
                        \`;
                        
                        // Set initial display based on saved state
                        if (!snowEnabled) {
                            snowContainer.style.display = 'none';
                        }
                        
                        document.body.appendChild(snowContainer);

                        // Create individual snowflakes
                        function createSnowflake() {
                            const snowflake = document.createElement('div');
                            snowflake.style.cssText = \`
                                position: absolute;
                                background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(220,240,255,0.8) 100%);
                                border-radius: 50%;
                                filter: blur(0.5px);
                                box-shadow: 
                                    0 0 10px rgba(255, 255, 255, 0.8),
                                    0 0 20px rgba(200, 220, 255, 0.4),
                                    inset 0 0 5px rgba(255, 255, 255, 0.5);
                            \`;
                            
                            // Random size (smaller for more premium feel)
                            const size = Math.random() * 5 + 2;
                            snowflake.style.width = \`\${size}px\`;
                            snowflake.style.height = \`\${size}px\`;
                            
                            // Random starting position
                            snowflake.style.left = \`\${Math.random() * 100}vw\`;
                            snowflake.style.top = \`-10px\`;
                            
                            // Random opacity for depth
                            snowflake.style.opacity = Math.random() * 0.7 + 0.3;
                            
                            // Add to container
                            snowContainer.appendChild(snowflake);
                            
                            // Animate snowflake
                            animateSnowflake(snowflake);
                        }
                        
                        function animateSnowflake(snowflake) {
                            const duration = Math.random() * 10 + 15; // 15-25 seconds
                            const horizontalDrift = (Math.random() - 0.5) * 50; // Random horizontal movement
                            const rotation = Math.random() * 360;
                            
                            // Use CSS animations for better performance
                            snowflake.style.transition = \`none\`;
                            snowflake.style.transform = \`translate(0, 0) rotate(0deg)\`;
                            
                            // Force reflow
                            snowflake.offsetHeight;
                            
                            // Animate
                            snowflake.style.transition = \`transform \${duration}s linear, opacity \${duration * 0.8}s ease-out\`;
                            snowflake.style.transform = \`translate(\${horizontalDrift}px, 100vh) rotate(\${rotation}deg)\`;
                            snowflake.style.opacity = '0';
                            
                            // Remove and recreate snowflake when animation completes
                            setTimeout(() => {
                                if (snowflake.parentNode) {
                                    snowflake.parentNode.removeChild(snowflake);
                                    if (snowEnabled) {
                                        createSnowflake();
                                    }
                                }
                            }, duration * 1000);
                        }
                        
                        // Create initial snowflakes if enabled
                        if (snowEnabled) {
                            const snowflakeCount = Math.min(50, Math.floor(window.innerWidth / 15));
                            for (let i = 0; i < snowflakeCount; i++) {
                                setTimeout(() => createSnowflake(), Math.random() * 3000);
                            }
                        }
                        
                        // Adjust snowflake creation based on window size
                        function adjustSnowflakes() {
                            if (!snowEnabled) return;
                            
                            const currentSnowflakes = snowContainer.children.length;
                            const targetSnowflakes = Math.min(100, Math.floor(window.innerWidth / 15));
                            
                            if (currentSnowflakes < targetSnowflakes) {
                                // Add more snowflakes
                                for (let i = 0; i < targetSnowflakes - currentSnowflakes; i++) {
                                    setTimeout(() => createSnowflake(), Math.random() * 1000);
                                }
                            }
                        }
                        
                        // Listen for window resize
                        window.addEventListener('resize', adjustSnowflakes);
                        
                        // Create status span with fade in/out transition
                        const statusSpan = document.createElement('div');
                        statusSpan.id = 'snow-effect-status';
                        statusSpan.style.cssText = \`
                            position: fixed;
                            bottom: 20px;
                            right: 20px;
                            background: rgba(0, 0, 0, 0.7);
                            color: \${snowEnabled ? 'white' : '#888'};
                            padding: 8px 16px;
                            border-radius: 20px;
                            font-size: 12px;
                            z-index: 10000;
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            cursor: pointer;
                            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                            user-select: none;
                            opacity: \${snowEnabled ? '1' : '0.7'};
                            transform: translateY(0);
                            -webkit-tap-highlight-color: transparent; /* Remove mobile tap highlight */
                            touch-action: manipulation; /* Better touch handling */
                        \`;
                        statusSpan.innerHTML = '<span>❄️</span><span>' + (snowEnabled ? 'Snow: ON' : 'Snow: OFF') + '</span>';
                        document.body.appendChild(statusSpan);
                        
                        // Helper function to fade out status span
                        function fadeOutStatus() {
                            statusSpan.style.opacity = '0';
                            statusSpan.style.transform = 'translateY(10px)';
                            setTimeout(() => {
                                statusSpan.style.pointerEvents = 'none';
                            }, 500); // Match transition duration
                        }
                        
                        // Helper function to fade in status span
                        function fadeInStatus() {
                            statusSpan.style.pointerEvents = 'auto';
                            statusSpan.style.transform = 'translateY(0)';
                            // Wait a frame to ensure pointer-events is set
                            requestAnimationFrame(() => {
                                statusSpan.style.opacity = snowEnabled ? '1' : '0.7';
                            });
                        }
                        
                        // Function to add logo glow effect
                        function addLogoGlow() {
                            console.log('Attempting to start logo glow...');
                            
                            // Clear any existing interval first
                            if (glowInterval) {
                                console.log('Clearing existing glow interval');
                                clearInterval(glowInterval);
                                glowInterval = null;
                            }
                            
                            const logo = document.querySelector('img[alt="logo"]');
                            if (!logo) {
                                console.log('Logo not found, skipping glow effect');
                                return;
                            }
                            
                            if (!snowEnabled) {
                                console.log('Snow not enabled, skipping glow');
                                return;
                            }
                            
                            if (isInAnimePlayer || isInMangaReader) {
                                console.log('In player/reader, skipping glow');
                                return;
                            }
                            
                            console.log('Starting logo glow effect');
                            
                            // Reset logo style
                            logo.style.transition = 'filter 2s ease';
                            logo.style.filter = '';
                            
                            // Create new glow interval
                            glowInterval = setInterval(() => {
                                if (!snowEnabled || isInAnimePlayer || isInMangaReader) {
                                    console.log('Stopping glow due to state change');
                                    clearInterval(glowInterval);
                                    glowInterval = null;
                                    logo.style.filter = '';
                                    return;
                                }
                                
                                // Add glow
                                logo.style.filter = 'drop-shadow(0 0 8px rgba(100, 150, 255, 0.7))';
                                
                                // Remove glow after a moment
                                setTimeout(() => {
                                    if (snowEnabled && logo && !isInAnimePlayer && !isInMangaReader && glowInterval) {
                                        logo.style.filter = 'drop-shadow(0 0 4px rgba(100, 150, 255, 0.3))';
                                    }
                                }, 1000);
                            }, 3000);
                        }
                        
                        // Function to stop logo glow
                        function stopLogoGlow() {
                            console.log('Stopping logo glow');
                            
                            if (glowInterval) {
                                clearInterval(glowInterval);
                                glowInterval = null;
                            }
                            
                            const logo = document.querySelector('img[alt="logo"]');
                            if (logo) {
                                logo.style.transition = 'filter 0.5s ease';
                                logo.style.filter = '';
                            }
                        }
                        
                        // Mobile-friendly toggle handler
                        function toggleSnowEffect() {
                            console.log('Toggling snow effect:', !snowEnabled);
                            
                            snowEnabled = !snowEnabled;
                            
                            // Save state
                            try {
                                localStorage.setItem('seanime-snow-enabled', snowEnabled.toString());
                            } catch(e) {}
                            
                            // Update status span text
                            const textSpan = statusSpan.querySelector('span:last-child');
                            if (textSpan) {
                                textSpan.textContent = snowEnabled ? 'Snow: ON' : 'Snow: OFF';
                            }
                            
                            // Fade transition for status span
                            statusSpan.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                            statusSpan.style.color = snowEnabled ? 'white' : '#888';
                            
                            // Handle logo glow based on new state
                            if (snowEnabled) {
                                console.log('Snow enabled, checking for logo glow');
                                
                                // Start logo glow after a short delay
                                setTimeout(() => {
                                    if (!isInAnimePlayer && !isInMangaReader) {
                                        addLogoGlow();
                                    } else {
                                        console.log('Skipping logo glow - in player/reader');
                                    }
                                }, 300);
                                
                                snowContainer.style.display = 'block';
                                // Force reflow before fading in
                                snowContainer.offsetHeight;
                                snowContainer.style.opacity = '1';
                                
                                // Start snow
                                const snowflakeCount = Math.min(50, Math.floor(window.innerWidth / 15));
                                const currentCount = snowContainer.children.length;
                                if (currentCount < snowflakeCount) {
                                    for (let i = 0; i < snowflakeCount - currentCount; i++) {
                                        setTimeout(() => createSnowflake(), Math.random() * 1000);
                                    }
                                }
                                
                                console.log('Snow effect enabled');
                            } else {
                                console.log('Snow disabled, stopping logo glow');
                                // Stop logo glow when disabled
                                stopLogoGlow();
                                
                                snowContainer.style.opacity = '0';
                                // Hide after fade out completes
                                setTimeout(() => {
                                    snowContainer.style.display = 'none';
                                }, 500); // Match transition duration
                                
                                console.log('Snow effect disabled');
                            }
                            
                            // Update visibility based on current state
                            updateStatusVisibility();
                            
                            // Add click feedback for mobile
                            if ('ontouchstart' in window) {
                                statusSpan.style.transform = 'scale(0.95)';
                                setTimeout(() => {
                                    statusSpan.style.transform = 'scale(1)';
                                }, 150);
                            }
                        }
                        
                        // Add click handler (desktop and mobile)
                        statusSpan.addEventListener('click', toggleSnowEffect);
                        
                        // Add touch handlers for better mobile experience
                        statusSpan.addEventListener('touchstart', function(e) {
                            e.preventDefault(); // Prevent scrolling
                            if (!isInAnimePlayer && !isInMangaReader) {
                                this.style.background = 'rgba(0, 0, 0, 0.9)';
                                this.style.transform = 'scale(0.95)';
                            }
                        }, { passive: false });
                        
                        statusSpan.addEventListener('touchend', function() {
                            if (!isInAnimePlayer && !isInMangaReader) {
                                this.style.background = 'rgba(0, 0, 0, 0.7)';
                                this.style.transform = 'scale(1)';
                            }
                        });
                        
                        // Add hover effect for desktop
                        statusSpan.addEventListener('mouseenter', function() {
                            if (!isInAnimePlayer && !isInMangaReader) {
                                this.style.background = 'rgba(0, 0, 0, 0.9)';
                                this.style.transform = 'scale(1.05)';
                            }
                        });
                        
                        statusSpan.addEventListener('mouseleave', function() {
                            if (!isInAnimePlayer && !isInMangaReader) {
                                this.style.background = 'rgba(0, 0, 0, 0.7)';
                                this.style.transform = 'scale(1)';
                            }
                        });
                        
                        console.log('Snow Effect Activated');
                        
                        // --- Anime Player Detection ---
                        function setupAnimePlayerDetection() {
                            console.log('Setting up anime player detection...');
                            
                            // Check initial state
                            checkAnimePlayerState();
                            
                            // Create observer to watch for video container changes
                            animePlayerObserver = new MutationObserver((mutations) => {
                                let shouldCheck = false;
                                for (const mutation of mutations) {
                                    // Check for attribute changes (z-index changes)
                                    if (mutation.type === 'attributes' && 
                                        mutation.attributeName === 'class' &&
                                        mutation.target.hasAttribute('data-vc-element')) {
                                        shouldCheck = true;
                                        break;
                                    }
                                    // Check for element addition/removal
                                    if (mutation.type === 'childList') {
                                        shouldCheck = true;
                                        break;
                                    }
                                }
                                
                                if (shouldCheck) {
                                    checkAnimePlayerState();
                                }
                            });
                            
                            // Start observing the entire document for video container changes
                            animePlayerObserver.observe(document.body, {
                                childList: true,
                                subtree: true,
                                attributes: true,
                                attributeFilter: ['class']
                            });
                            
                            // Also check on URL changes
                            let lastPath = window.location.pathname;
                            setInterval(() => {
                                if (window.location.pathname !== lastPath) {
                                    lastPath = window.location.pathname;
                                    checkAnimePlayerState();
                                }
                            }, 1000);
                        }
                        
                        function checkAnimePlayerState() {
                            const path = window.location.pathname;
                            const isOnEntryPage = path.includes('/entry') && !path.includes('/manga/entry');
                            
                            if (!isOnEntryPage) {
                                if (isInAnimePlayer) {
                                    console.log('Left anime player page');
                                    isInAnimePlayer = false;
                                    updateStatusVisibility();
                                }
                                return;
                            }
                            
                            // Look for video container
                            const videoContainer = document.querySelector('[data-vc-element="inline-container"]');
                            
                            if (videoContainer) {
                                // Check if it has high z-index (fullscreen mode)
                                const hasHighZIndex = videoContainer.classList.contains('fixed') && 
                                                     videoContainer.classList.contains('z-[99999]') &&
                                                     videoContainer.classList.contains('inset-0');
                                
                                if (hasHighZIndex && !isInAnimePlayer) {
                                    console.log('Entered anime player (fullscreen mode detected)');
                                    isInAnimePlayer = true;
                                    updateStatusVisibility();
                                } else if (!hasHighZIndex && isInAnimePlayer) {
                                    console.log('Exited anime player fullscreen');
                                    isInAnimePlayer = false;
                                    updateStatusVisibility();
                                }
                            } else if (isInAnimePlayer) {
                                // Video container removed
                                console.log('Video container removed, exiting anime player');
                                isInAnimePlayer = false;
                                updateStatusVisibility();
                            }
                        }
                        
                        // --- Manga Reader Detection ---
                        function setupMangaDetection() {
                            console.log('Setting up manga detection...');
                            
                            // Check initial state
                            checkMangaState();
                            
                            // Create observer to watch for manga page container
                            mangaObserver = new MutationObserver((mutations) => {
                                let shouldCheck = false;
                                for (const mutation of mutations) {
                                    if (mutation.type === 'childList') {
                                        shouldCheck = true;
                                        break;
                                    }
                                }
                                
                                if (shouldCheck) {
                                    checkMangaState();
                                }
                            });
                            
                            // Start observing the entire document
                            mangaObserver.observe(document.body, {
                                childList: true,
                                subtree: true
                            });
                            
                            // Also check periodically
                            setInterval(checkMangaState, 1000);
                        }
                        
                        function checkMangaState() {
                            // Simple check: if the manga container exists, we're in manga reader
                            const mangaContainer = document.querySelector('[data-chapter-page-container="true"]');
                            const wasInMangaReader = isInMangaReader;
                            
                            if (mangaContainer && !isInMangaReader) {
                                console.log('Entered manga reader (container found)');
                                isInMangaReader = true;
                                updateStatusVisibility();
                            } else if (!mangaContainer && isInMangaReader) {
                                console.log('Exited manga reader (container not found)');
                                isInMangaReader = false;
                                updateStatusVisibility();
                            }
                        }
                        
                        // Update status visibility
                        function updateStatusVisibility() {
                            const statusElement = document.getElementById('snow-effect-status');
                            if (!statusElement) return;
                            
                            // Hide if in anime player OR manga reader
                            if (isInAnimePlayer || isInMangaReader) {
                                console.log('Hiding snow - in player/reader');
                                // Stop logo glow when in player/reader
                                stopLogoGlow();
                                
                                // Fade out status
                                fadeOutStatus();
                                
                                // Also fade out snow container
                                if (snowEnabled) {
                                    snowContainer.style.opacity = '0';
                                    setTimeout(() => {
                                        snowContainer.style.display = 'none';
                                    }, 500);
                                }
                            } else {
                                console.log('Showing snow - not in player/reader');
                                // Fade back in
                                fadeInStatus();
                                
                                // Show snow container if enabled
                                if (snowEnabled) {
                                    snowContainer.style.display = 'block';
                                    // Force reflow before fading in
                                    snowContainer.offsetHeight;
                                    snowContainer.style.opacity = '1';
                                    
                                    // Start logo glow if snow is enabled
                                    console.log('Snow enabled, attempting logo glow');
                                    setTimeout(() => {
                                        addLogoGlow();
                                    }, 300);
                                } else {
                                    // Stop logo glow if snow is disabled
                                    console.log('Snow disabled, stopping logo glow');
                                    stopLogoGlow();
                                }
                            }
                        }
                        
                        // Initialize everything
                        function initializePlugin() {
                            // Setup all detection systems
                            setupAnimePlayerDetection();
                            setupMangaDetection();
                            
                            // Start logo glow if enabled on load
                            if (snowEnabled) {
                                console.log('initializing with snow enabled, checking for logo glow');
                                // Wait a bit for detection systems to initialize
                                setTimeout(() => {
                                    if (!isInAnimePlayer && !isInMangaReader) {
                                        console.log('Starting initial logo glow');
                                        setTimeout(addLogoGlow, 1500);
                                    } else {
                                        console.log('Skipping initial logo glow - in player/reader');
                                    }
                                }, 500);
                            }
                        }
                        
                        // Start initialization
                        initializePlugin();
                        
                        // Clean up on page unload
                        window.addEventListener('beforeunload', () => {
                            try {
                                localStorage.setItem('seanime-snow-enabled', snowEnabled.toString());
                            } catch(e) {}
                            
                            // Clean up glow interval
                            if (glowInterval) {
                                clearInterval(glowInterval);
                            }
                            
                            // Clean up observers
                            if (animePlayerObserver) {
                                animePlayerObserver.disconnect();
                            }
                            if (mangaObserver) {
                                mangaObserver.disconnect();
                            }
                        });
                        
                    })();
                `);
                
                // Append the script to the body
                const body = await ctx.dom.queryOne("body");
                if (body) {
                    await body.append(snowScript);
                    console.log('Snow script injected successfully!');
                    ctx.toast.success("Snow effect loaded!");
                } else {
                    console.error('Could not find body element');
                    ctx.toast.error("Failed to load snow effect");
                }
                
            } catch (error) {
                console.error('Error injecting snow script:', error);
                ctx.toast.error("Failed to load snow effect");
            }
        });
    });
}

/// <reference path="./online-streaming-provider.d.ts" />

/**
 * Animetoast Provider
 * Implements the Provider interface for scraping Animetoast.cc.
 */
class Provider {
    constructor() {
        this.base = "https://www.animetoast.cc";
    }

    /**
     * Helper function to clean the anime title by removing language/version tags
     * like "Ger Dub", "Ger Sub", "Staffel 2", etc.
     * @param {string} title - The raw title string.
     * @returns {string} The cleaned title.
     */
    cleanTitle(title) {
        // Regex to remove common language/version tags (case-insensitive)
        return title
            .replace(/(\s*(?:ger|deutsch|eng)\s*(?:dub|sub|saison|season|staffel)\s*\d*\s*)/gi, '')
            .replace(/(\s*(?:ger|deutsch|eng)\s*(?:dub|sub)\s*)/gi, '')
            .replace(/\s*-\s*$/, "") // remove trailing dash
            .trim();
    }

    /**
     * Internal helper to fetch a URL and extract a JavaScript redirect target.
     * Implements basic exponential backoff for retries.
     * @param {string} url - The URL to fetch.
     * @returns {Promise<string>} The extracted redirect URL.
     */
    async fetchAndExtractRedirect(url) {
        let attempts = 0;
        const maxAttempts = 3;
        const initialDelay = 1000;

        while (attempts < maxAttempts) {
            try {
                const res = await fetch(url);
                const html = await res.text();
                
                // Regex to find window.location.href assignment (for the else {} block logic)
                const regex = /window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/gs;
                const match = regex.exec(html);

                if (match) {
                    return match[1];
                } else {
                    console.error(`[Animetoast] Failed to find JS redirect pattern in HTML from: ${url}`);
                    throw new Error("JS redirect pattern not found");
                }
            } catch (error) {
                attempts++;
                if (attempts >= maxAttempts) {
                    throw new Error(`Failed to follow redirect after ${maxAttempts} attempts. Last error: ${error.message}`);
                }
                const delay = initialDelay * Math.pow(2, attempts - 1);
                console.warn(`[Animetoast] Attempt ${attempts} failed for ${url}, retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }


    getSettings() {
        return {
            episodeServers: ["AnimeToast"],
            supportsDub: true,
        };
    }

    /**
     * Searches Animetoast, filtering results based on query.dub (0 for sub, 1 for dub).
     * @param {{query: string, dub: number}} query
     * @returns {Promise<Array<OnlineStreamingResult>>}
     */
    async search(query) {
        const res = await fetch(`${this.base}/?s=${encodeURIComponent(query.query)}`);
        const html = await res.text();

        // Regex to capture the anime URL and the raw title
        const regex = /<h3><a href="(.*?)"[^>]*title="(.*?)"/gs;
        const results = [];
        let match;

        while ((match = regex.exec(html)) !== null) {
            const url = match[1];
            const rawTitle = match[2];
            const isDub = /dub/i.test(rawTitle);
            const subOrDub = isDub ? "dub" : "sub";

            // Apply filtering logic
            if (query.dub === 1 && !isDub) {
                continue; // Skip non-dub when dub is requested
            }
            if (query.dub === 0 && isDub) {
                continue; // Skip dub when sub is requested
            }

            const title = this.cleanTitle(rawTitle);
            const id = url.replace(this.base, '').replace(/\//g, ''); // Use the slug as ID

            results.push({
                id: id,
                title: title,
                url: url,
                subOrDub: subOrDub,
            });
        }

        if (!results.length) throw new Error("No anime found");
        return results;
    }

    /**
     * Finds all available episodes for a given anime ID.
     * IMPORTANT: Uses a Map to ensure only one entry per episode number is kept (the first one found, which corresponds
     * to the primary mirror/server link in the first tab). This addresses the user requirement to only scrape the first list.
     * @param {string} id - The anime slug/ID.
     * @returns {Promise<Array<OnlineStreamingEpisode>>}
     */
    async findEpisodes(id) {
        const res = await fetch(`${this.base}/${id}`);
        const html = await res.text();

        // Episode links: href=".../?link=0">...Ep. 1...
        const regex = /href="(.*?link=\d+)"[^>]*>.*?Ep\.\s*(\d+)\s*</gs;
        const episodesMap = new Map(); // Map to store episodes by number, ensuring uniqueness
        let match;

        while ((match = regex.exec(html)) !== null) {
            const url = match[1];
            const number = parseInt(match[2], 10);
            
            // Only add the first link found for a given episode number (discards subsequent mirror links)
            if (episodesMap.has(number)) {
                continue;
            }
            
            const episodeId = url.replace(this.base, ''); 

            episodesMap.set(number, {
                id: episodeId,
                title: `Episode ${number}`,
                number: number,
                url: url,
            });
        }

        // Convert map values back to an array
        const episodes = Array.from(episodesMap.values());

        // Sort by episode number ascending (optional but good practice)
        episodes.sort((a, b) => a.number - b.number);
        
        return episodes;
    }

    /**
     * Finds the video source for a specific episode from the specified server.
     * This involves a multi-step fetch and redirect chain.
     * @param {OnlineStreamingEpisode} episode
     * @param {string} _server - The server name (always "AnimeToast" in this case).
     * @returns {Promise<OnlineStreamingServer>}
     */
    async findEpisodeServer(episode, _server) {
        // --- STEP 1: Get the voe.sx embed URL from the episode page ---
        const res = await fetch(episode.url);
        const html = await res.text();

        // Scrape the initial voe.sx embed link
        const embedMatch = html.match(/<div id="player-embed"\s*>\s*<a href="(https?:\/\/voe\.sx\/[^"]+)"/);
        if (!embedMatch) throw new Error("Voe.sx embed URL not found (Step 1: Check embed match in episode page)");
        const voeSxUrl = embedMatch[1];
        
        // --- STEP 2: Follow voe.sx redirect to intermediate host (e.g., walterprettytheir.com) ---
        let downloadHostUrl;
        try {
            downloadHostUrl = await this.fetchAndExtractRedirect(voeSxUrl);
        } catch (e) {
            throw new Error(`Failed to follow Voe.sx redirect (Step 2): ${e.message}`);
        }
        
        // --- STEP 3: Get the link to the final download redirect page (on the intermediate host) ---
        const downloadPage1Res = await fetch(downloadHostUrl);
        const downloadPage1Html = await downloadPage1Res.text();
        
        // Scrape the href attribute from the download button using the unique class (robust regex)
        // Checks for class="btn btn-primary download-user-file" followed by href attribute
        const downloadLinkMatch = downloadPage1Html.match(/class="btn btn-primary download-user-file"[^>]*?href="([^"]+)"/);
        if (!downloadLinkMatch) throw new Error("First download link (href) not found (Step 3: Check download-user-file button)");

        const downloadHref = downloadLinkMatch[1];
        // Resolve the URL (handle both relative and absolute links)
        const downloadPage1Url = downloadHref.startsWith('http') 
            ? downloadHref 
            : `${downloadHostUrl.replace(/\/$/, '')}${downloadHref.startsWith('/') ? '' : '/'}${downloadHref}`;
        
        // --- STEP 4: Follow second host redirect (e.g., to christopheruntilpoint.com/download) ---
        let finalHostUrl;
        try {
            finalHostUrl = await this.fetchAndExtractRedirect(downloadPage1Url);
        } catch (e) {
            throw new Error(`Failed to follow second redirect (Step 4): ${e.message}`);
        }
        
        // --- STEP 5: Get the final MP4 stream link ---
        const finalStreamPageRes = await fetch(finalHostUrl);
        const finalStreamPageHtml = await finalStreamPageRes.text();
        
        // Scrape the final MP4 link from the btn-secondary (robust regex)
        // Checks for class="btn btn-secondary" followed by the href attribute containing the MP4 URL
        const videoUrlMatch = finalStreamPageHtml.match(/class="btn btn-secondary"[^>]*?href="(https?:\/\/[^"]+\.mp4\?[^"]*)"/);
        if (!videoUrlMatch) throw new Error("Final video URL not found (Step 5: Check final stream page for MP4 link)");
        
        const videoUrl = videoUrlMatch[1];

        // Headers are likely required to prevent blocking the direct video link
        const headers = {
            "Referer": finalHostUrl, // Use the final host page as referer
        };

        return {
            server: "AnimeToast",
            headers: headers,
            videoSources: [
                {
                    url: videoUrl,
                    quality: "720p", // Based on the scraped quality text
                    type: "mp4",
                    subtitles: [],
                },
            ],
        };
    }
}
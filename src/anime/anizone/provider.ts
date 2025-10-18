/// <reference path="./online-streaming-provider.d.ts" />

/**
 * Anizone Provider for Seanime.
 */
class Provider {
    baseUrl = "https://anizone.to";

    getSettings(): Settings {
        return {
            episodeServers: ["Anizone Player"],
            supportsDub: false // The source snippets only show one set of subtitles/tracks.
        }
    }

    /**
     * Searches for anime on anizone.to.
     * Uses the pattern: /anime?search={query}
     */
    async search(query: SearchOptions): Promise<SearchResult[]> {
        const url = `${this.baseUrl}/anime?search=${encodeURIComponent(query.query)}`;
        const html = await fetch(url).then(res => res.text());
        const $ = LoadDoc(html);
        
        const results: SearchResult[] = [];

        // The search result items are wrapped in a div with a specific wire:key.
        // We look for the main link and title inside this block.
        $(".relative.overflow-hidden.h-26.rounded-lg.px-4.py-3.bg-slate-900").each((_, el) => {
            const linkEl = $(el).find("a[wire\\:navigate][title]");
            
            // e.g., https://anizone.to/anime/eu8bdgty
            const fullUrl = linkEl.attr("href"); 
            // e.g., eu8bdgty
            const idMatch = fullUrl?.match(/\/anime\/([a-z0-9]+)/i); 
            
            if (idMatch) {
                const id = idMatch[1];
                const title = linkEl.attr("title")!; // e.g., Ore dake Level Up na Ken

                results.push({
                    id: id,
                    title: title,
                    url: fullUrl!,
                    // Anizone appears to only support subbed content based on the example.
                    subOrDub: "sub", 
                });
            }
        });

        // The example extension uses a complex Levenshtein search logic.
        // For simplicity in this first draft, we return the first result, 
        // which is often the best match on modern anime sites.
        // You can later add more complex matching if needed.
        if (results.length > 0) {
            return [results[0]];
        }
        
        return [];
    }

    /**
     * Fetches the list of episodes for a given anime ID.
     * The ID is the anime's slug/hash, e.g., 'eu8bdgty'.
     * Uses the pattern: /anime/{id}
     */
    async findEpisodes(animeId: string): Promise<EpisodeDetails[]> {
        const url = `${this.baseUrl}/anime/${animeId}`;
        const html = await fetch(url).then(res => res.text());
        const $ = LoadDoc(html);
        
        const episodes: EpisodeDetails[] = [];

        // Episode items are <li> elements containing an <a> link.
        $("li a[wire\\:navigate][href]").each((_, el) => {
            const fullUrl = $(el).attr("href")!; // e.g., https://anizone.to/anime/eu8bdgty/1
            
            // Extract episode number from the URL
            const urlMatch = fullUrl.match(/\/(\d+)$/);
            if (!urlMatch) return;
            
            const number = parseInt(urlMatch[1], 10);
            
            // The unique ID for the episode will be its anime-id + episode-number, 
            // since the base URL is what we need to visit to get the stream.
            // e.g., eu8bdgty/1
            const id = `${animeId}/${number}`; 
            
            // Extract the title, e.g., "Episode 1 : I`m Used to It"
            const titleEl = $(el).find("h3");
            const title = titleEl.text().trim();
            
            episodes.push({
                id: id,
                number: number,
                url: fullUrl,
                title: title.length > 0 ? title : `Episode ${number}`,
            });
        });
        
        return episodes;
    }

    /**
     * Fetches the video source and subtitles for a specific episode.
     * The episode ID is a combination of anime-id/episode-number, e.g., 'eu8bdgty/1'.
     */
    async findEpisodeServer(episode: EpisodeDetails, _server: string): Promise<EpisodeServer> {
        // The episode.url is already the direct stream page URL, e.g., https://anizone.to/anime/eu8bdgty/1
        const url = episode.url; 
        const html = await fetch(url).then(res => res.text());
        const $ = LoadDoc(html);
        
        // 1. Get the video stream URL (master.m3u8)
        // Search the HTML for the <media-player> tag which contains the src attribute.
        const streamSrc = $("media-player[src]").attr("src");
        
        if (!streamSrc) {
            throw new Error("Could not find master stream source on episode page.");
        }
        
        // 2. Get the subtitles
        const subtitles: VideoSubtitle[] = [];
        
        // Find all <track> elements, which contain the subtitle links.
        $("track[kind='subtitles']").each((index, el) => {
            const trackEl = $(el);
            const subUrl = trackEl.attr("src")!;
            const label = trackEl.attr("label")!;
            const isDefault = trackEl.is("[default]");

            if (subUrl) {
                subtitles.push({
                    id: `sub-${index}`,
                    url: subUrl,
                    language: label,
                    isDefault: isDefault,
                });
            }
        });

        // 3. Construct the final EpisodeServer object.
        return {
            server: "Anizone Player",
            // The search result shows the stream uses a CDN (vid-cdn.xyz), so a Referer 
            // header from the main site is often necessary to prevent hotlinking issues.
            headers: { 
                "Referer": this.baseUrl,
                // A common User-Agent header is good practice
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            },
            videoSources: [{
                url: streamSrc,
                type: "m3u8", // It's a master.m3u8 file
                quality: "auto", // M3U8 usually contains all qualities
                subtitles: subtitles
            }]
        };
    }
}

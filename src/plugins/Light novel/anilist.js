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
            throw new Error(`Network response was not ok: ${res.statusText}`);
        }
        const json = await res.json();
        return json.data;
    } catch (err) {
        console.error("[novel-plugin] Anilist API Error:", err);
        return null;
    }
}

async function getTrendingLightNovels() {
    const query = `
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
    `;
    const data = await fetchAnilist(query);
    return data?.Page?.media || [];
}

async function searchAnilistLightNovels(search) {
    const query = `
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
    `;
    const data = await fetchAnilist(query, { search });
    return data?.Page?.media || [];
}

async function getAnilistLightNovelDetails(id) {
    const query = `
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
    `;
    const data = await fetchAnilist(query, { id });
    return data?.Media || null;
}

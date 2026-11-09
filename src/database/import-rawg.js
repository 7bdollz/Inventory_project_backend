import pool from "./pg.js";

const apiKey = process.env.RAWG_API_KEY;
const apiRoot = "https://api.rawg.io/api";

if (!apiKey) {
    throw new Error("Set RAWG_API_KEY in backend/.env before running the RAWG importer.");
}

const fetchJson = async (path, params = {}) => {
    const url = new URL(`${apiRoot}/${path}`);
    url.searchParams.set("key", apiKey);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`RAWG request failed with status ${response.status} for ${url.pathname}`);
    }
    return response.json();
};

const collectCatalog = async () => {
    const platforms = [];
    for (let page = 1; ; page += 1) {
        const result = await fetchJson("platforms", { page: String(page), page_size: "40" });
        platforms.push(...(result.results ?? []));
        if (!result.next) break;
    }

    const games = new Map();
    for (const platform of platforms) {
        let collected = 0;
        for (let page = 1; collected < 50; page += 1) {
            const pageSize = Math.min(40, 50 - collected);
            const result = await fetchJson("games", {
                platforms: String(platform.id),
                ordering: "-added",
                page: String(page),
                page_size: String(pageSize),
            });
            const batch = result.results ?? [];
            if (!batch.length) break;
            collected += batch.length;

            for (const game of batch) {
                const item = games.get(game.id) ?? {
                    title: game.name,
                    imageUrl: game.background_image,
                    released: game.released || null,
                    rating: game.rating || null,
                    genres: new Set(),
                    platforms: new Set(),
                };
                item.platforms.add(platform.name);
                for (const genre of game.genres ?? []) item.genres.add(genre.name);
                games.set(game.id, item);
            }
        }
        console.log(`${platform.name}: fetched ${Math.min(collected, 50)} games`);
    }
    return { games: [...games.values()], platformNames: platforms.map(({ name }) => name) };
};

const replaceCatalog = async ({ games, platformNames }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("TRUNCATE TABLE game_genres, game_platforms, games, genres, platforms RESTART IDENTITY");

        for (const name of platformNames) {
            await client.query("INSERT INTO platforms (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [name]);
        }

        for (const game of games) {
            const result = await client.query(
                `INSERT INTO games (title, image_url, released, rating, price, quantity)
                 VALUES ($1, $2, $3, $4, 0, 0) RETURNING id`,
                [game.title, game.imageUrl, game.released, game.rating]
            );
            const gameId = result.rows[0].id;

            for (const genre of game.genres) {
                await client.query("INSERT INTO genres (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [genre]);
                await client.query(
                    `INSERT INTO game_genres (game_id, genre_id)
                     SELECT $1, id FROM genres WHERE name = $2 ON CONFLICT DO NOTHING`,
                    [gameId, genre]
                );
            }
            for (const platform of game.platforms) {
                await client.query(
                    `INSERT INTO game_platforms (game_id, platform_id)
                     SELECT $1, id FROM platforms WHERE name = $2 ON CONFLICT DO NOTHING`,
                    [gameId, platform]
                );
            }
        }
        await client.query("COMMIT");
        console.log(`Replaced catalog with ${games.length} unique games across ${platformNames.length} platforms.`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

try {
    const catalog = await collectCatalog();
    await replaceCatalog(catalog);
} catch (error) {
    console.error("RAWG import failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}

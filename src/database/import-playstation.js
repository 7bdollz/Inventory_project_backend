import pool from "./pg.js";

const atlasRoot = "https://raw.githubusercontent.com/JigSawFr/Atlas/data/platforms";
const storeRoot = "https://raw.githubusercontent.com/Ephellon/game-store-catalog/main";
const platformSets = ["ps4", "ps5"];

const fetchJson = async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Source request failed (${response.status}): ${url}`);
    return response.json();
};

const normalizeId = (value) => String(value ?? "").trim().toUpperCase();
const normalizeTitle = (value) => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const storeFileFor = (name) => {
    const first = [...String(name).trim()][0] ?? "_";
    return /^[a-z]$/i.test(first) ? `${first.toLowerCase()}.json` : "_.json";
};

const recordsFromStoreFile = (payload) => {
    if (Array.isArray(payload)) {
        return payload.map((entry) => Array.isArray(entry) ? { name: entry[0], ...entry[1] } : entry);
    }
    return Object.entries(payload ?? {}).map(([name, details]) => ({ name, ...details }));
};

const loadPlatformTop = async (platform) => {
    const [popularity, catalog] = await Promise.all([
        fetchJson(`${atlasRoot}/${platform}/popular.json`),
        fetchJson(`${atlasRoot}/${platform}/games.json`),
    ]);
    const gamesById = catalog.games ?? {};
    const idsByRank = Object.entries(popularity.games ?? {})
        .sort((a, b) => Number(b[1]?.[0] ?? 0) - Number(a[1]?.[0] ?? 0))
        .map(([qid]) => qid);

    const candidates = [];
    for (const qid of idsByRank) {
        const game = gamesById[qid];
        if (!game?.name || !game.ps_product?.length) continue;
        candidates.push({ qid, ...game });
        if (candidates.length === 150) break;
    }
    return candidates;
};

const attachStoreArtwork = async (platform, candidates) => {
    const files = [...new Set(candidates.map((game) => storeFileFor(game.name)))];
    const records = (await Promise.all(files.map(async (file) => {
        const url = `${storeRoot}/${platform}/${encodeURIComponent(file)}`;
        try {
            return recordsFromStoreFile(await fetchJson(url));
        } catch (error) {
            console.warn(`Skipping unavailable ${platform} artwork shard ${file}: ${error.message}`);
            return [];
        }
    }))).flat();

    const byProductId = new Map();
    const byTitle = new Map();
    for (const record of records) {
        if (record.uuid) byProductId.set(normalizeId(record.uuid), record);
        const normalized = normalizeTitle(record.name);
        if (normalized && record.image) byTitle.set(normalized, record);
    }

    return candidates.map((game) => {
        const exactProduct = game.ps_product
            .map((productId) => byProductId.get(normalizeId(productId)))
            .find(Boolean);
        const storeRecord = exactProduct ?? byTitle.get(normalizeTitle(game.name));
        return {
            ...game,
            imageUrl: storeRecord?.image ?? null,
            storeProductId: storeRecord?.uuid ?? null,
            platform,
        };
    });
};

const dateFromAtlas = (date) => {
    if (!date) return null;
    const value = String(date);
    if (!/^\d{8}$/.test(value)) return null;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
};

const makeCatalog = async () => {
    const catalog = [];
    for (const platform of platformSets) {
        const candidates = await loadPlatformTop(platform);
        const withArtwork = await attachStoreArtwork(platform, candidates);
        const mapped = withArtwork.filter((game) => game.imageUrl).slice(0, 50);
        console.log(`${platform.toUpperCase()}: ${candidates.length} ranked candidates, ${mapped.length} with cover art`);
        catalog.push(...mapped);
    }
    return catalog;
};

const importCatalog = async (catalog) => {
    if (!catalog.length) throw new Error("No PlayStation games with cover art were fetched; database was not changed.");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`
            DELETE FROM game_platforms gp USING platforms p
            WHERE gp.platform_id = p.id AND LOWER(p.name) IN ('playstation', 'playstation 4', 'playstation 5')
        `);
        await client.query(`
            DELETE FROM games g
            WHERE NOT EXISTS (SELECT 1 FROM game_platforms gp WHERE gp.game_id = g.id)
        `);
        await client.query(`
            DELETE FROM genres ge
            WHERE NOT EXISTS (SELECT 1 FROM game_genres gg WHERE gg.genre_id = ge.id)
        `);
        await client.query(`
            DELETE FROM platforms p
            WHERE LOWER(p.name) = 'playstation'
              AND NOT EXISTS (SELECT 1 FROM game_platforms gp WHERE gp.platform_id = p.id)
        `);

        const byTitle = new Map();
        for (const game of catalog) {
            const key = game.qid || normalizeTitle(game.name);
            const item = byTitle.get(key) ?? {
                title: game.name,
                imageUrl: game.imageUrl,
                released: dateFromAtlas(game.release),
                developer: game.developers?.[0]?.[1] ?? null,
                genres: new Set(),
                platforms: new Set(),
            };
            if (!item.imageUrl && game.imageUrl) item.imageUrl = game.imageUrl;
            if (!item.released && game.release) item.released = dateFromAtlas(game.release);
            for (const [, name] of game.genres ?? []) item.genres.add(name);
            item.platforms.add(game.platform === "ps4" ? "PlayStation 4" : "PlayStation 5");
            byTitle.set(key, item);
        }

        for (const game of byTitle.values()) {
            const inserted = await client.query(
                `INSERT INTO games (title, description, developer, image_url, price, quantity, released, rating)
                 VALUES ($1, NULL, $2, $3, 0, 0, $4, NULL) RETURNING id`,
                [game.title, game.developer, game.imageUrl, game.released]
            );
            const gameId = inserted.rows[0].id;

            for (const platform of game.platforms) {
                await client.query("INSERT INTO platforms (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [platform]);
                await client.query(
                    `INSERT INTO game_platforms (game_id, platform_id)
                     SELECT $1, id FROM platforms WHERE name = $2 ON CONFLICT DO NOTHING`,
                    [gameId, platform]
                );
            }
            for (const genre of game.genres) {
                await client.query("INSERT INTO genres (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [genre]);
                await client.query(
                    `INSERT INTO game_genres (game_id, genre_id)
                     SELECT $1, id FROM genres WHERE name = $2 ON CONFLICT DO NOTHING`,
                    [gameId, genre]
                );
            }
        }
        await client.query("COMMIT");
        console.log(`Imported ${byTitle.size} unique PlayStation games.`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

try {
    const catalog = await makeCatalog();
    await importCatalog(catalog);
} catch (error) {
    console.error("PlayStation import failed:", error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}

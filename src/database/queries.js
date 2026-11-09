import { Client } from "pg";
import pool from "./pg.js";

const gameSelect = `
    SELECT g.*,
        ARRAY(SELECT ge.name FROM game_genres gg JOIN genres ge ON ge.id = gg.genre_id WHERE gg.game_id = g.id) AS genres,
        ARRAY(SELECT p.name FROM game_platforms gp JOIN platforms p ON p.id = gp.platform_id WHERE gp.game_id = g.id) AS platforms
    FROM games g`;

export const getGames = async () => (await pool.query(`${gameSelect} ORDER BY g.title`)).rows;

export const getGameById = async (id) =>
    (await pool.query(`${gameSelect} WHERE g.id = $1`, [id])).rows[0] ?? null;

export const getGameByTitle = async (title) =>
    (await pool.query(`${gameSelect} WHERE LOWER(g.title) = LOWER($1)`, [title])).rows[0] ?? null;

export const insertGame = async (Client,{ title, description, developer, image_url, price, quantity = 0 }) =>
    {
        const result = await Client.query(
        `INSERT INTO games (title, description, developer, image_url, price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [title, description, developer, image_url, price, quantity]
    )
    return result.rows[0]
};

export const insertGenre = async (Client,{ name, description }) =>
    (await Client.query(
        `INSERT INTO genres (name, description)
         VALUES ($1, $2)
         RETURNING *`,
        [name, description]
    )).rows[0];

export const insertPlatform = async (Client,{ name, description }) =>
    (await Client.query(
        `INSERT INTO platforms (name, description)
         VALUES ($1, $2)
         RETURNING *`,
        [name, description]
    )).rows[0];

export const insertGameGenre = async (Client,gameId, genreId) =>
    (await Client.query(
        `INSERT INTO game_genres (game_id, genre_id)
         VALUES ($1, $2)
         RETURNING *`,
        [gameId, genreId]
    )).rows[0];

export const insertGamePlatform = async (Client,gameId, platformId) =>
    (await Client.query(
        `INSERT INTO game_platforms (game_id, platform_id)
         VALUES ($1, $2)
         RETURNING *`,
        [gameId, platformId]
    )).rows[0];

export const getGenres = async () => (await pool.query("SELECT * FROM genres ORDER BY name")).rows;

export const getPlatforms = async () => (await pool.query("SELECT * FROM platforms ORDER BY name")).rows;

export const getInventorySummary = async () =>
    (await pool.query(`
        SELECT COUNT(*) AS game_count,
               COALESCE(SUM(quantity), 0) AS total_quantity,
               COALESCE(SUM(price * quantity), 0) AS inventory_value
        FROM games
    `)).rows[0];

export const deleteGameById = async(id)=>
{
    try
    {
        await pool.query("DELETE FROM games WHERE id = $1",[id])
        console.log("game deleted succefully")
    }catch(error)
    {
        console.log("Error: ",error.message)
    }
}
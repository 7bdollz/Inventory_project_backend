import pool from "./pg.js";

const SQL = `
CREATE TABLE IF NOT EXISTS games (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,title VARCHAR(150) NOT NULL,description TEXT,developer VARCHAR(150),image_url TEXT,price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),released DATE,rating NUMERIC(3,2));
ALTER TABLE games ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS released DATE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2);
CREATE TABLE IF NOT EXISTS genres (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name VARCHAR(100) NOT NULL UNIQUE,description TEXT);
CREATE TABLE IF NOT EXISTS platforms (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name VARCHAR(100) NOT NULL UNIQUE,description TEXT);
CREATE TABLE IF NOT EXISTS game_genres (game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,PRIMARY KEY (game_id,genre_id));
CREATE TABLE IF NOT EXISTS game_platforms (game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE RESTRICT,PRIMARY KEY (game_id,platform_id));
`
const createTables=async()=>
{
    try
    {
        await pool.query("BEGIN")
        await pool.query(SQL)
        await pool.query("COMMIT")

        console.log("all tables created succesfully!")
    }catch(error)
    {
        await pool.query("ROLLBACK")
        console.error("Error creating tables: ",error.message)
        process.exitCode = 1
    }
    finally
    {
        await pool.end()
    }
}

createTables()

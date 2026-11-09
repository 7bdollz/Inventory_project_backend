import { getGameByTitle, insertGame, insertGameGenre, insertGamePlatform, insertGenre, insertPlatform } from "../database/queries.js";
import pool from "../database/pg.js";
import { validationResult } from "express-validator";

 const details = {
        title: "Efootball",
        description: "An electronic football game.",
        developer: "Konami",
        image_url: null,
        price: 59.99,
        quantity: 5,
        genre:"Football",
        genre_details:"Electronic football games played on mobile devices and gaming consoles",
        platform:"mobile phones"
    }

const AddGameController = async (req, res) => {
    const client = await pool.connect()
    const errors = validationResult(req)
    if(!errors.isEmpty())
    {
        return res.status(400).json({success:false,errors:errors.array()})
    }
    const details = req.body
    console.log(details)
    const existingGame = await getGameByTitle(details.title);
    try
    {
        await client.query("BEGIN")
        const game = existingGame ?? await insertGame(client,details);
        const gameId = game.id
        const genre = await insertGenre(client,{name:details.genre,description:details.genre_details})
        const genreId = genre.id
        const gameGenre = await insertGameGenre(client,gameId,genreId)
        const platform = await insertPlatform(client,{name:details.platform,description:"mobile devices"})
        const platformId = platform.id
        const gamePlatform = await insertGamePlatform(client,gameId,platformId)
        await client.query("COMMIT")
        res.redirect("/")
    }
    catch(error)
    {
        await client.query("ROLLBACK")
        res.status(500).json({error:error.message})
    }
    finally
    {
        client.release()
    }
    
};

export default AddGameController;

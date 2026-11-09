import { getGames } from "../database/queries.js";

const getGamesController = async (req, res) => {
    const games = await getGames()
    games?res.locals.games = games:res.locals.games=null
    res.render("home")
}

export default getGamesController

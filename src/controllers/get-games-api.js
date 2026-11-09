import { getGames } from "../database/queries.js";

const getGamesApiController = async (req, res) => {
    try {
        const games = await getGames();
        res.json(games);
    } catch (error) {
        console.error("Failed to fetch games:", error);
        res.status(500).json({ error: "Unable to fetch games" });
    }
};

export default getGamesApiController;

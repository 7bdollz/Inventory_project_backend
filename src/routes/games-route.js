import { Router } from "express";
import getGamesController from "../controllers/get-games.js";
import getGamesApiController from "../controllers/get-games-api.js";
import AddGameController from "../controllers/seed-game.js";
import getFormController from "../controllers/get-game-form.js";
import { deleteGameController } from "../controllers/delete-game.js";


const gamesRoute = Router()

gamesRoute.get("/api/games", getGamesApiController)
gamesRoute.get("/",getGamesController)
gamesRoute.post("/add", AddGameController)
gamesRoute.get("/form",getFormController)
gamesRoute.get("/delete/:id",deleteGameController)

export default gamesRoute

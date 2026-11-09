import { deleteGameById } from "../database/queries.js";

export const deleteGameController=(req,res)=>
{
    const gameId = req.params.id
    deleteGameById(Number(gameId))
    res.redirect("/")
}
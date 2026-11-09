import express, { urlencoded } from "express"
import path from "path"
import cors from "cors"
import gamesRoute from "./routes/games-route.js"

const port = process.env.PORT
const app = express()
app.use(cors())
app.use(urlencoded({extended:true}))
app.set("views",path.join(import.meta.dirname,"views"))
app.set("view engine","ejs")

app.use("/",gamesRoute)

app.listen(port,()=>
{
    console.log(`app running on port:${port}`)
})
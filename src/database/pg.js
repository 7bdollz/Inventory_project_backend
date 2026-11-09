import pg from "pg"
import fs from "fs"
const {Pool} = pg

const pool = new Pool({
    connectionString:process.env.G_INVENTORY_DATABASE,
     ssl: {
        ca: fs.readFileSync("./certs/ca.pem", "utf8"),
        rejectUnauthorized: true,
    },
})

export default pool
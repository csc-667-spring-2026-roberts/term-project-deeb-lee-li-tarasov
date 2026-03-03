import pgp from "pg-promise";

import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL as string;

const db = pgp()(connectionString);

export default db;

import pgp from "pg-promise";


const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

if (!connectionString) {
  throw new Error("DATABASE_URL must be set.");
}

const db = pgp()({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export default db;

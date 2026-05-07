import "dotenv/config";
import fs from "fs";
import path from "path";
import db from "./connection.js";

const migrationsDir = path.join(process.cwd(), "migrations");

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  await db.none(sql);
  console.log("ran", file);
}

console.log("migrations complete");

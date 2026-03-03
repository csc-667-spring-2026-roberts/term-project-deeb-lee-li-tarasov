import { Router } from "express";
import db from "./db/connection.js";
const router = Router();

router.get("/dbtest", async (_req, res) => {
  await db.none("INSERT INTO test_table (message) VALUES ($1)", ["Hello from Express"]);

  const records = await db.any("SELECT * FROM test_table;");
  res.json(records);
});

export default router;

import { Router } from "express";
import db from "./db/connection.js";
import bcrypt from "bcrypt";
import "express-session";
import { protectRoute } from "./middleware/auth.js";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}
const router = Router();

router.get("/dbtest", protectRoute, async (_req, res) => {
  const records = await db.any("SELECT id, username, email, created_at FROM users;");
  res.json(records);
});

router.post("/auth/register", async (req, res) => {
  const { email, password, username } = req.body as {
    email: string;
    password: string;
    username: string;
  };
  const hash = await bcrypt.hash(password, 10);

  try {
    const user = await db.one<{ id: number }>(
      "INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id",
      [email, hash, username],
    );
    req.session.userId = user.id;
    res.json({ success: true });
  } catch {
    res.status(500).send("Registration failed.");
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const genericError = "Invalid email or password.";

  const user = await db.oneOrNone<{ id: number; password_hash: string }>(
    "SELECT * FROM users WHERE email = $1",
    [email],
  );
  if (!user) return res.status(401).send(genericError);

  const match = await bcrypt.compare(password, user.password_hash);
  if (match) {
    req.session.userId = user.id;
    res.json({ success: true });
  } else {
    res.status(401).send(genericError);
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

export default router;

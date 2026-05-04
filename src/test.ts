import { Router } from "express";
import bcrypt from "bcrypt";
import db from "./db/connection.js";
import {
  protectRoute,
  redirectIfAuthenticated,
  type AuthenticatedUser,
} from "./middleware/auth.js";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

interface AuthFormBody {
  email?: string;
  password?: string;
  username?: string;
}

const router = Router();

router.get("/", (_req, res) => {
  res.redirect("/login");
});

router.get("/register", redirectIfAuthenticated, (_req, res) => {
  res.render("register", {
    title: "Register",
    error: null,
    formData: { email: "", username: "" },
  });
});

router.get("/login", redirectIfAuthenticated, (_req, res) => {
  res.render("login", {
    title: "Login",
    error: null,
    formData: { email: "" },
  });
});

router.get("/lobby", protectRoute, async (req, res) => {
  const user = await db.oneOrNone<AuthenticatedUser>(
    "SELECT id, username, email, created_at FROM users WHERE id = $1",
    [req.session.userId],
  );

  if (!user) {
    req.session.userId = undefined;
    res.redirect("/login");
    return;
  }

  res.render("lobby", {
    title: "Lobby",
    user,
  });
});

router.get("/api/users", protectRoute, async (_req, res) => {
  const users = await db.any<{ username: string; email: string }>(
    "SELECT username, email FROM users",
  );
  res.json(users);
});

router.get("/dbtest", protectRoute, async (_req, res) => {
  const records = await db.any("SELECT id, username, email, created_at FROM users;");
  res.render("dbtest", {
    title: "DB Test",
    records,
  });
});

router.post("/auth/register", async (req, res) => {
  const { email = "", password = "", username = "" } = req.body as AuthFormBody;
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedUsername = username.trim();

  if (!trimmedEmail || !password || !trimmedUsername) {
    res.status(400).render("register", {
      title: "Register",
      error: "Email, username, and password are required.",
      formData: { email: trimmedEmail, username: trimmedUsername },
    });
    return;
  }

  const existingUser = await db.oneOrNone<{ id: number }>(
    "SELECT id FROM users WHERE email = $1 OR username = $2",
    [trimmedEmail, trimmedUsername],
  );

  if (existingUser) {
    res.status(400).render("register", {
      title: "Register",
      error: "That email or username is already in use.",
      formData: { email: trimmedEmail, username: trimmedUsername },
    });
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const user = await db.one<{ id: number }>(
      "INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id",
      [trimmedEmail, hash, trimmedUsername],
    );

    req.session.userId = user.id;
    res.redirect("/lobby");
  } catch {
    res.status(500).render("register", {
      title: "Register",
      error: "Registration failed. Please try again.",
      formData: { email: trimmedEmail, username: trimmedUsername },
    });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email = "", password = "" } = req.body as AuthFormBody;
  const trimmedEmail = email.trim().toLowerCase();
  const genericError = "Invalid email or password.";

  const user = await db.oneOrNone<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [trimmedEmail],
  );

  if (!user) {
    res.status(401).render("login", {
      title: "Login",
      error: genericError,
      formData: { email: trimmedEmail },
    });
    return;
  }

  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    res.status(401).render("login", {
      title: "Login",
      error: genericError,
      formData: { email: trimmedEmail },
    });
    return;
  }

  req.session.userId = user.id;
  res.redirect("/lobby");
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

export default router;

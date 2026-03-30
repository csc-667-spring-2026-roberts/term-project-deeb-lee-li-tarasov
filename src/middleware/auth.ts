import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import db from "../db/connection.js";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

const buildGravatarUrl = (email: string): string => {
  const hash = crypto
    .createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");

  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=160`;
};

export const attachCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.session.userId;

  res.locals.currentUser = null;
  res.locals.error = null;
  res.locals.gravatarUrl = null;

  if (!userId) {
    next();
    return;
  }

  const user = await db.oneOrNone<AuthenticatedUser>(
    "SELECT id, username, email, created_at FROM users WHERE id = $1",
    [userId],
  );

  if (!user) {
    req.session.userId = undefined;
    next();
    return;
  }

  res.locals.currentUser = user;
  res.locals.gravatarUrl = buildGravatarUrl(user.email);
  next();
};

export const protectRoute = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.session.userId) {
    res.redirect("/login");
    return;
  }

  next();
};

export const redirectIfAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.session.userId) {
    res.redirect("/lobby");
    return;
  }

  next();
};

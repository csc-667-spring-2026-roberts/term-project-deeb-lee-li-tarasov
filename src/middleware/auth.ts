import { Request, Response, NextFunction } from "express";

export const protectRoute = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
};

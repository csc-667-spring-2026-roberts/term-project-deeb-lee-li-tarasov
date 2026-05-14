import { Router } from "express";
import { protectRoute, type AuthenticatedUser } from "../middleware/auth.js";
import { listOpenGames, createGame, joinGame, startGame, getGameDetail } from "../db/games.js";

const router = Router();

router.get("/games", protectRoute, async (_req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const games = await listOpenGames(user.id);
  res.render("games/index", { title: "Games", games, user });
});

router.post("/games", protectRoute, async (_req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  await createGame(user.id);
  res.redirect("/games");
});

router.post("/games/:id/join", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);

  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).redirect("/games");
    return;
  }

  const error = await joinGame(gameId, user.id);
  if (error) {
    const games = await listOpenGames(user.id);
    res.status(400).render("games/index", { title: "Games", games, user, error });
    return;
  }

  res.redirect("/games");
});

router.get("/games/:id", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);

  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).redirect("/games");
    return;
  }

  const data = await getGameDetail(gameId);
  if (!data) {
    res.status(404).redirect("/games");
    return;
  }

  res.render("games/show", {
    title: `Game #${String(gameId)}`,
    game: data.game,
    players: data.players,
    user,
    isCreator: user.id === data.game.created_by,
  });
});

router.post("/games/:id/start", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);

  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).redirect("/games");
    return;
  }

  const error = await startGame(gameId, user.id);
  if (error) {
    const games = await listOpenGames(user.id);
    res.status(400).render("games/index", { title: "Games", games, user, error });
    return;
  }

  res.redirect(`/games/${String(gameId)}`);
});

export default router;

import { Router } from "express";
import { protectRoute, type AuthenticatedUser } from "../middleware/auth.js";
import {
  listOpenGames,
  createGame,
  joinGame,
  startGame,
  getGameDetail,
  rollDice,
  movePlayer,
} from "../db/games.js";
import { gameConnect, broadcastSse } from "../sse.js";

interface MoveBody {
  room?: string;
}

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

router.get("/api/games/:id/events", protectRoute, (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).end();
    return;
  }
  gameConnect(req, res, gameId, user.username);
});

router.post("/api/games/:id/roll", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const result = await rollDice(gameId, user.id);
  if (typeof result === "string") {
    res.status(400).json({ error: result });
    return;
  }
  broadcastSse({ type: "dice_rolled" }, { event: "state", room: `game:${String(gameId)}` });
  res.json(result);
});

router.post("/api/games/:id/move", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const { room } = req.body as MoveBody;
  if (!room) {
    res.status(400).json({ error: "Room is required" });
    return;
  }
  const error = await movePlayer(gameId, user.id, room);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  broadcastSse({ type: "turn_advanced" }, { event: "state", room: `game:${String(gameId)}` });
  res.json({ ok: true });
});

export default router;

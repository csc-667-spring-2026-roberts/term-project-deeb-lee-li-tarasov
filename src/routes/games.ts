import { Router } from "express";
import { protectRoute, type AuthenticatedUser } from "../middleware/auth.js";
import {
  listOpenGames,
  createGame,
  joinGame,
  startGame,
  getGameState,
  rollDice,
  movePlayer,
  makeSuggestion,
  respondToSuggestion,
  advanceTurn,
  makeAccusation,
  sendChatMessage,
  getChatMessages,
} from "../db/games.js";
import { gameConnect, broadcastSse } from "../sse.js";

interface MoveBody {
  room?: string;
}

interface SuggestBody {
  suspectCardId?: number;
  weaponCardId?: number;
}

interface RespondBody {
  cardId?: number | null;
}

interface AccuseBody {
  suspectCardId?: number;
  weaponCardId?: number;
  roomCardId?: number;
}

interface ChatBody {
  content?: string;
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
  broadcastSse({ type: "game_created" }, { event: "games", room: "lobby" });
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

  broadcastSse({ type: "game_joined" }, { event: "games", room: "lobby" });
  broadcastSse({ type: "player_joined" }, { event: "state", room: `game:${String(gameId)}` });
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

  const state = await getGameState(gameId, user.id);
  if (!state) {
    res.status(404).redirect("/games");
    return;
  }

  res.render("games/show", {
    title: `Game #${String(gameId)}`,
    state,
    user,
    isCreator: user.id === state.game.created_by,
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

  broadcastSse({ type: "game_started" }, { event: "games", room: "lobby" });
  broadcastSse({ type: "game_started" }, { event: "state", room: `game:${String(gameId)}` });
  res.redirect(`/games/${String(gameId)}`);
});

router.get("/api/games/:id/state", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const state = await getGameState(gameId, user.id);
  if (!state) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  res.json(state);
});

router.post("/api/games/:id/end-turn", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const state = await getGameState(gameId, user.id);
  if (!state || state.myPlayerId !== state.game.current_turn_player_id) {
    res.status(400).json({ error: "It is not your turn." });
    return;
  }
  const error = await advanceTurn(gameId);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  broadcastSse({ type: "turn_advanced" }, { event: "state", room: `game:${String(gameId)}` });
  res.json({ ok: true });
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

router.post("/api/games/:id/suggest", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const { suspectCardId, weaponCardId } = req.body as SuggestBody;
  if (!suspectCardId || !weaponCardId) {
    res.status(400).json({ error: "suspectCardId and weaponCardId are required" });
    return;
  }
  const error = await makeSuggestion(gameId, user.id, suspectCardId, weaponCardId);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  broadcastSse({ type: "suggestion_made" }, { event: "state", room: `game:${String(gameId)}` });
  res.json({ ok: true });
});

router.post("/api/games/:id/respond", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const body = req.body as RespondBody;
  if (!("cardId" in body)) {
    res.status(400).json({ error: "cardId is required (use null to pass)" });
    return;
  }
  const cardId = body.cardId ?? null;
  const result = await respondToSuggestion(gameId, user.id, cardId);
  if (typeof result === "string") {
    res.status(400).json({ error: result });
    return;
  }
  if (result.done) {
    const advanceError = await advanceTurn(gameId);
    if (advanceError) {
      res.status(500).json({ error: advanceError });
      return;
    }
    broadcastSse({ type: "turn_advanced" }, { event: "state", room: `game:${String(gameId)}` });
  } else {
    broadcastSse({ type: "response_needed" }, { event: "state", room: `game:${String(gameId)}` });
  }
  res.json({ ok: true, done: result.done });
});

router.post("/api/games/:id/accuse", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const { suspectCardId, weaponCardId, roomCardId } = req.body as AccuseBody;
  if (!suspectCardId || !weaponCardId || !roomCardId) {
    res.status(400).json({ error: "suspectCardId, weaponCardId, and roomCardId are required" });
    return;
  }
  const result = await makeAccusation(gameId, user.id, suspectCardId, weaponCardId, roomCardId);
  if (typeof result === "string") {
    res.status(400).json({ error: result });
    return;
  }
  if (result.correct) {
    broadcastSse({ type: "game_over" }, { event: "state", room: `game:${String(gameId)}` });
  } else {
    broadcastSse({ type: "player_eliminated" }, { event: "state", room: `game:${String(gameId)}` });
  }
  res.json({ ok: true, correct: result.correct, eliminated: result.eliminated });
});

router.get("/api/games/:id/chat", protectRoute, async (req, res) => {
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const messages = await getChatMessages(gameId);
  res.json(messages);
});

router.post("/api/games/:id/chat", protectRoute, async (req, res) => {
  const user = res.locals.currentUser as AuthenticatedUser;
  const gameIdStr = req.params["id"];
  const gameId = Number(gameIdStr);
  if (!gameIdStr || isNaN(gameId)) {
    res.status(400).json({ error: "Invalid game id" });
    return;
  }
  const { content } = req.body as ChatBody;
  if (!content?.trim()) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }
  const result = await sendChatMessage(gameId, user.id, content.trim());
  if (typeof result === "string") {
    res.status(400).json({ error: result });
    return;
  }
  broadcastSse(result, { event: "chat", room: `game:${String(gameId)}` });
  res.json({ ok: true });
});

export default router;

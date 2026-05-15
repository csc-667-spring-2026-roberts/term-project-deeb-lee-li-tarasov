import db from "./connection.js";

const CHARACTERS: string[] = [
  "Miss Scarlett",
  "Colonel Mustard",
  "Mrs. White",
  "Reverend Green",
  "Mrs. Peacock",
  "Professor Plum",
];

export interface GameListing {
  id: number;
  status: string;
  max_players: number;
  creator_username: string;
  player_count: number;
  user_in_game: boolean;
}

function pickCharacter(index: number): string {
  return CHARACTERS[index] ?? "Miss Scarlett";
}

export async function listOpenGames(userId: number): Promise<GameListing[]> {
  return db.any<GameListing>(
    `SELECT g.id, g.status, g.max_players,
            u.username AS creator_username,
            COUNT(gp.id)::int AS player_count,
            EXISTS(
              SELECT 1 FROM game_players WHERE game_id = g.id AND user_id = $1
            ) AS user_in_game
     FROM games g
     JOIN users u ON u.id = g.created_by
     LEFT JOIN game_players gp ON gp.game_id = g.id
     WHERE g.status IN ('lobby', 'in_progress')
     GROUP BY g.id, u.username
     ORDER BY g.id DESC`,
    [userId],
  );
}

export async function createGame(userId: number): Promise<number> {
  return db.tx(async (t) => {
    const game = await t.one<{ id: number }>(
      "INSERT INTO games (created_by) VALUES ($1) RETURNING id",
      [userId],
    );
    await t.none(
      "INSERT INTO game_players (game_id, user_id, character, turn_order) VALUES ($1, $2, $3, 1)",
      [game.id, userId, pickCharacter(0)],
    );
    return game.id;
  });
}

interface CardRow {
  id: number;
}

interface PlayerRow {
  id: number;
  character: string;
}

interface Hand {
  playerId: number;
  cardId: number;
}

interface WeaponPlacement {
  weaponCardId: number;
  roomCardId: number;
}

interface BoardPlacement {
  playerId: number;
  x: number;
  y: number;
}

export interface GameDetail {
  id: number;
  status: string;
  max_players: number;
  created_by: number;
  current_turn_player_id: number | null;
}

export interface GamePlayerDetail {
  id: number;
  username: string;
  character: string;
  turn_order: number;
  is_current_turn: boolean;
}

export interface GameWithPlayers {
  game: GameDetail;
  players: GamePlayerDetail[];
}

const STARTING_POSITIONS: Record<string, { x: number; y: number }> = {
  "Miss Scarlett": { x: 17, y: 0 },
  "Colonel Mustard": { x: 23, y: 14 },
  "Mrs. White": { x: 9, y: 24 },
  "Reverend Green": { x: 14, y: 24 },
  "Mrs. Peacock": { x: 0, y: 6 },
  "Professor Plum": { x: 0, y: 19 },
};

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

function pickRandom<T>(arr: T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error("Cannot pick from empty array");
  return item;
}

function buildHands(players: PlayerRow[], cards: CardRow[]): Hand[] {
  return cards.map((card, i) => ({
    playerId: players[i % players.length]?.id ?? 0,
    cardId: card.id,
  }));
}

function buildWeaponPlacements(weapons: CardRow[], rooms: CardRow[]): WeaponPlacement[] {
  const shuffledRooms = shuffle(rooms);
  return weapons.map((w, i) => ({
    weaponCardId: w.id,
    roomCardId: shuffledRooms[i % shuffledRooms.length]?.id ?? 0,
  }));
}

function buildBoardPlacements(players: PlayerRow[]): BoardPlacement[] {
  return players.map((p) => {
    const pos = STARTING_POSITIONS[p.character] ?? { x: 0, y: 0 };
    return { playerId: p.id, x: pos.x, y: pos.y };
  });
}

export async function startGame(gameId: number, userId: number): Promise<string | null> {
  return db.tx(async (t) => {
    const game = await t.oneOrNone<{ status: string; created_by: number }>(
      "SELECT status, created_by FROM games WHERE id = $1",
      [gameId],
    );
    if (!game) return "Game not found.";
    if (game.created_by !== userId) return "Only the creator can start the game.";
    if (game.status !== "lobby") return "Game already started.";

    const players = await t.any<PlayerRow>(
      "SELECT id, character FROM game_players WHERE game_id = $1 ORDER BY turn_order",
      [gameId],
    );
    if (players.length < 2) return "Need at least 2 players to start.";

    const suspects = await t.any<CardRow>("SELECT id FROM cards WHERE type = 'suspect'");
    const weapons = await t.any<CardRow>("SELECT id FROM cards WHERE type = 'weapon'");
    const rooms = await t.any<CardRow>("SELECT id FROM cards WHERE type = 'room'");

    const solution = {
      suspect: pickRandom(suspects),
      weapon: pickRandom(weapons),
      room: pickRandom(rooms),
    };

    await t.none(
      "INSERT INTO game_solutions (game_id, suspect_card_id, weapon_card_id, room_card_id) VALUES ($1, $2, $3, $4)",
      [gameId, solution.suspect.id, solution.weapon.id, solution.room.id],
    );

    const remaining = shuffle([
      ...suspects.filter((c) => c.id !== solution.suspect.id),
      ...weapons.filter((c) => c.id !== solution.weapon.id),
      ...rooms.filter((c) => c.id !== solution.room.id),
    ]);
    const shuffledPlayers = shuffle(players);

    for (const hand of buildHands(shuffledPlayers, remaining)) {
      await t.none(
        "INSERT INTO game_player_cards (game_id, player_id, card_id) VALUES ($1, $2, $3)",
        [gameId, hand.playerId, hand.cardId],
      );
    }

    for (const p of buildBoardPlacements(shuffledPlayers)) {
      await t.none(
        "INSERT INTO board_positions (game_id, player_id, x, y) VALUES ($1, $2, $3, $4)",
        [gameId, p.playerId, p.x, p.y],
      );
    }

    for (const wp of buildWeaponPlacements(weapons, rooms)) {
      await t.none(
        "INSERT INTO weapon_positions (game_id, weapon_card_id, room_card_id) VALUES ($1, $2, $3)",
        [gameId, wp.weaponCardId, wp.roomCardId],
      );
    }

    for (let i = 0; i < shuffledPlayers.length; i++) {
      const player = shuffledPlayers[i];
      if (!player) continue;
      await t.none("UPDATE game_players SET turn_order = $1 WHERE id = $2", [i + 1, player.id]);
    }

    const firstPlayer = shuffledPlayers[0];
    if (!firstPlayer) return "Failed to determine first player.";

    await t.none(
      "UPDATE games SET status = 'in_progress', started_at = now(), current_turn_player_id = $1 WHERE id = $2",
      [firstPlayer.id, gameId],
    );

    return null;
  });
}

const VALID_ROOMS = new Set([
  "Kitchen",
  "Ballroom",
  "Conservatory",
  "Billiard Room",
  "Library",
  "Study",
  "Hall",
  "Lounge",
  "Dining Room",
]);

const ROOM_POSITIONS: Record<string, { x: number; y: number }> = {
  Kitchen: { x: 4, y: 4 },
  Ballroom: { x: 12, y: 2 },
  Conservatory: { x: 20, y: 4 },
  "Billiard Room": { x: 4, y: 12 },
  Library: { x: 12, y: 12 },
  Study: { x: 20, y: 12 },
  Hall: { x: 4, y: 20 },
  Lounge: { x: 12, y: 20 },
  "Dining Room": { x: 20, y: 20 },
};

export async function rollDice(
  gameId: number,
  userId: number,
): Promise<{ roll1: number; roll2: number } | string> {
  return db.tx(async (t) => {
    const game = await t.oneOrNone<{ status: string; current_turn_player_id: number | null }>(
      "SELECT status, current_turn_player_id FROM games WHERE id = $1",
      [gameId],
    );
    if (!game || game.status !== "in_progress") return "Game not in progress.";

    const player = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2",
      [gameId, userId],
    );
    if (!player) return "You are not in this game.";
    if (player.id !== game.current_turn_player_id) return "It is not your turn.";

    const latest = await t.oneOrNone<{
      dice_roll_1: number | null;
      moved_to_room: string | null;
      player_id: number;
    }>(
      "SELECT dice_roll_1, moved_to_room, player_id FROM game_turns WHERE game_id = $1 ORDER BY turn_number DESC LIMIT 1",
      [gameId],
    );
    if (
      latest &&
      latest.player_id === player.id &&
      latest.dice_roll_1 !== null &&
      latest.moved_to_room === null
    ) {
      return "Already rolled this turn.";
    }

    const roll1 = Math.ceil(Math.random() * 6);
    const roll2 = Math.ceil(Math.random() * 6);

    const row = await t.one<{ next_turn: number }>(
      "SELECT COALESCE(MAX(turn_number), 0)::int + 1 AS next_turn FROM game_turns WHERE game_id = $1",
      [gameId],
    );

    await t.none(
      "INSERT INTO game_turns (game_id, player_id, turn_number, dice_roll_1, dice_roll_2, action_type) VALUES ($1, $2, $3, $4, $5, 'move')",
      [gameId, player.id, row.next_turn, roll1, roll2],
    );

    return { roll1, roll2 };
  });
}

export async function movePlayer(
  gameId: number,
  userId: number,
  room: string,
): Promise<string | null> {
  if (!VALID_ROOMS.has(room)) return "Invalid room.";

  return db.tx(async (t) => {
    const game = await t.oneOrNone<{ status: string; current_turn_player_id: number | null }>(
      "SELECT status, current_turn_player_id FROM games WHERE id = $1",
      [gameId],
    );
    if (!game || game.status !== "in_progress") return "Game not in progress.";

    const player = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2",
      [gameId, userId],
    );
    if (!player) return "You are not in this game.";
    if (player.id !== game.current_turn_player_id) return "It is not your turn.";

    const pendingTurn = await t.oneOrNone<{ id: number }>(
      `SELECT id FROM game_turns
       WHERE game_id = $1 AND player_id = $2 AND dice_roll_1 IS NOT NULL AND moved_to_room IS NULL
       ORDER BY turn_number DESC LIMIT 1`,
      [gameId, player.id],
    );
    if (!pendingTurn) return "Roll dice first.";

    const pos = ROOM_POSITIONS[room] ?? { x: 0, y: 0 };

    await t.none(
      "UPDATE game_turns SET moved_to_room = $1, moved_to_x = $2, moved_to_y = $3 WHERE id = $4",
      [room, pos.x, pos.y, pendingTurn.id],
    );

    await t.none(
      `INSERT INTO board_positions (game_id, player_id, x, y, room, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (player_id) DO UPDATE SET x = $3, y = $4, room = $5, updated_at = now()`,
      [gameId, player.id, pos.x, pos.y, room],
    );

    const allPlayers = await t.any<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND is_eliminated = false ORDER BY turn_order",
      [gameId],
    );
    const currentIndex = allPlayers.findIndex((p) => p.id === player.id);
    const nextPlayer = allPlayers[(currentIndex + 1) % allPlayers.length];
    if (!nextPlayer) return "Failed to advance turn.";

    await t.none("UPDATE games SET current_turn_player_id = $1 WHERE id = $2", [
      nextPlayer.id,
      gameId,
    ]);

    return null;
  });
}

export async function getGameDetail(gameId: number): Promise<GameWithPlayers | null> {
  const game = await db.oneOrNone<GameDetail>(
    "SELECT id, status, max_players, created_by, current_turn_player_id FROM games WHERE id = $1",
    [gameId],
  );
  if (!game) return null;

  const players = await db.any<GamePlayerDetail>(
    `SELECT gp.id, u.username, gp.character, gp.turn_order,
            (gp.id = $2) AS is_current_turn
     FROM game_players gp
     JOIN users u ON u.id = gp.user_id
     WHERE gp.game_id = $1
     ORDER BY gp.turn_order`,
    [gameId, game.current_turn_player_id],
  );

  return { game, players };
}

export async function joinGame(gameId: number, userId: number): Promise<string | null> {
  return db.tx(async (t) => {
    const game = await t.oneOrNone<{ status: string; max_players: number }>(
      "SELECT status, max_players FROM games WHERE id = $1",
      [gameId],
    );
    if (!game) return "Game not found.";
    if (game.status !== "lobby") return "Game already started.";

    const existing = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2",
      [gameId, userId],
    );
    if (existing) return "Already in this game.";

    const row = await t.one<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM game_players WHERE game_id = $1",
      [gameId],
    );
    if (row.count >= game.max_players) return "Game is full.";

    await t.none(
      "INSERT INTO game_players (game_id, user_id, character, turn_order) VALUES ($1, $2, $3, $4)",
      [gameId, userId, pickCharacter(row.count), row.count + 1],
    );
    return null;
  });
}

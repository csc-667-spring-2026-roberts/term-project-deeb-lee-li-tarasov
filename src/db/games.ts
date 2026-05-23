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
  trackPos: number;
}

export interface GameDetail {
  id: number;
  status: string;
  max_players: number;
  created_by: number;
  current_turn_player_id: number | null;
  winner_player_id: number | null;
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

interface TrackCell {
  col: number;
  row: number;
  room: string | null;
}

const TRACK: TrackCell[] = [
  { col: 0, row: 0, room: "Kitchen" },
  { col: 1, row: 0, room: null },
  { col: 2, row: 0, room: null },
  { col: 3, row: 0, room: null },
  { col: 4, row: 0, room: "Ballroom" },
  { col: 5, row: 0, room: null },
  { col: 6, row: 0, room: null },
  { col: 7, row: 0, room: null },
  { col: 8, row: 0, room: "Conservatory" },
  { col: 8, row: 1, room: null },
  { col: 8, row: 2, room: null },
  { col: 8, row: 3, room: null },
  { col: 8, row: 4, room: "Study" },
  { col: 7, row: 4, room: null },
  { col: 6, row: 4, room: null },
  { col: 5, row: 4, room: null },
  { col: 4, row: 4, room: "Library" },
  { col: 3, row: 4, room: null },
  { col: 2, row: 4, room: null },
  { col: 1, row: 4, room: null },
  { col: 0, row: 4, room: "Billiard Room" },
  { col: 0, row: 5, room: null },
  { col: 0, row: 6, room: null },
  { col: 0, row: 7, room: null },
  { col: 0, row: 8, room: "Hall" },
  { col: 1, row: 8, room: null },
  { col: 2, row: 8, room: null },
  { col: 3, row: 8, room: null },
  { col: 4, row: 8, room: "Lounge" },
  { col: 5, row: 8, room: null },
  { col: 6, row: 8, room: null },
  { col: 7, row: 8, room: null },
  { col: 8, row: 8, room: "Dining Room" },
];

const TRACK_LENGTH = TRACK.length;

const STARTING_TRACK_POS: Record<string, number> = {
  "Miss Scarlett": 1,
  "Colonel Mustard": 6,
  "Mrs. White": 10,
  "Reverend Green": 15,
  "Mrs. Peacock": 22,
  "Professor Plum": 27,
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
  return players.map((p) => ({
    playerId: p.id,
    trackPos: STARTING_TRACK_POS[p.character] ?? 1,
  }));
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
        "INSERT INTO board_positions (game_id, player_id, track_pos) VALUES ($1, $2, $3)",
        [gameId, p.playerId, p.trackPos],
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

export async function rollDice(
  gameId: number,
  userId: number,
): Promise<{ roll1: number; roll2: null } | string> {
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
      moved_to_track_pos: number | null;
      player_id: number;
    }>(
      "SELECT dice_roll_1, moved_to_track_pos, player_id FROM game_turns WHERE game_id = $1 ORDER BY turn_number DESC LIMIT 1",
      [gameId],
    );
    if (
      latest &&
      latest.player_id === player.id &&
      latest.dice_roll_1 !== null &&
      latest.moved_to_track_pos === null
    ) {
      return "Already rolled this turn.";
    }

    const roll1 = Math.ceil(Math.random() * 6);

    const row = await t.one<{ next_turn: number }>(
      "SELECT COALESCE(MAX(turn_number), 0)::int + 1 AS next_turn FROM game_turns WHERE game_id = $1",
      [gameId],
    );

    await t.none(
      "INSERT INTO game_turns (game_id, player_id, turn_number, dice_roll_1, action_type) VALUES ($1, $2, $3, $4, 'move')",
      [gameId, player.id, row.next_turn, roll1],
    );

    return { roll1, roll2: null };
  });
}

export async function movePlayer(
  gameId: number,
  userId: number,
  targetTrackPos: number,
): Promise<string | null> {
  if (targetTrackPos < 0 || targetTrackPos >= TRACK_LENGTH) return "Invalid position.";

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

    const pendingTurn = await t.oneOrNone<{ id: number; dice_roll_1: number }>(
      `SELECT id, dice_roll_1 FROM game_turns
       WHERE game_id = $1 AND player_id = $2 AND dice_roll_1 IS NOT NULL AND moved_to_track_pos IS NULL
       AND turn_number = (SELECT MAX(turn_number) FROM game_turns WHERE game_id = $1)`,
      [gameId, player.id],
    );
    if (!pendingTurn) return "Roll dice first.";

    const currentPos = await t.oneOrNone<{ track_pos: number | null }>(
      "SELECT track_pos FROM board_positions WHERE player_id = $1",
      [player.id],
    );
    const startPos = currentPos?.track_pos ?? 0;
    const roll = pendingTurn.dice_roll_1;
    const exactLanding = (startPos + roll) % TRACK_LENGTH;

    const isReachableRoom = (pos: number): boolean => {
      for (let i = 1; i <= roll; i++) {
        const p = (startPos + i) % TRACK_LENGTH;
        if (p === pos && TRACK[p]?.room !== null) return true;
      }
      return false;
    };

    const isExactLanding = targetTrackPos === exactLanding;
    if (!isReachableRoom(targetTrackPos) && !isExactLanding) {
      return "You cannot move there with your current roll.";
    }

    const cell = TRACK[targetTrackPos];
    const room = cell?.room ?? null;

    await t.none(
      "UPDATE game_turns SET moved_to_room = $1, moved_to_track_pos = $2 WHERE id = $3",
      [room, targetTrackPos, pendingTurn.id],
    );

    await t.none(
      `INSERT INTO board_positions (game_id, player_id, track_pos, room, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (player_id) DO UPDATE SET track_pos = $3, room = $4, updated_at = now()`,
      [gameId, player.id, targetTrackPos, room],
    );

    return null;
  });
}

interface ActiveSuggestion {
  id: number;
  suggesting_player_id: number;
  suspect_card_id: number;
  weapon_card_id: number;
  room_card_id: number;
  response_count: number;
}

function getResponders(allPlayers: { id: number }[], suggestingPlayerId: number): { id: number }[] {
  const idx = allPlayers.findIndex((p) => p.id === suggestingPlayerId);
  const result: { id: number }[] = [];
  for (let i = 1; i < allPlayers.length; i++) {
    const p = allPlayers[(idx + i) % allPlayers.length];
    if (p) result.push(p);
  }
  return result;
}

export async function makeSuggestion(
  gameId: number,
  userId: number,
  suspectCardId: number,
  weaponCardId: number,
): Promise<string | null> {
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

    const position = await t.oneOrNone<{ room: string | null }>(
      "SELECT room FROM board_positions WHERE player_id = $1",
      [player.id],
    );
    if (!position?.room) return "You must be in a room to make a suggestion.";

    const turn = await t.oneOrNone<{ id: number; action_type: string }>(
      `SELECT id, action_type FROM game_turns
       WHERE game_id = $1 AND player_id = $2 AND moved_to_room IS NOT NULL
       ORDER BY turn_number DESC LIMIT 1`,
      [gameId, player.id],
    );
    if (!turn) return "You must move to a room first.";
    if (turn.action_type === "suggestion") return "Already made a suggestion this turn.";

    const suspect = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM cards WHERE id = $1 AND type = 'suspect'",
      [suspectCardId],
    );
    if (!suspect) return "Invalid suspect card.";

    const weapon = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM cards WHERE id = $1 AND type = 'weapon'",
      [weaponCardId],
    );
    if (!weapon) return "Invalid weapon card.";

    const roomCard = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM cards WHERE name = $1 AND type = 'room'",
      [position.room],
    );
    if (!roomCard) return "Room card not found.";

    await t.none("UPDATE game_turns SET action_type = 'suggestion' WHERE id = $1", [turn.id]);

    await t.none(
      "INSERT INTO suggestions (turn_id, game_id, suggesting_player_id, suspect_card_id, weapon_card_id, room_card_id) VALUES ($1, $2, $3, $4, $5, $6)",
      [turn.id, gameId, player.id, suspectCardId, weaponCardId, roomCard.id],
    );

    return null;
  });
}

export async function respondToSuggestion(
  gameId: number,
  userId: number,
  cardId: number | null,
): Promise<{ done: boolean } | string> {
  return db.tx(async (t) => {
    const suggestion = await t.oneOrNone<ActiveSuggestion>(
      `SELECT s.id, s.suggesting_player_id, s.suspect_card_id, s.weapon_card_id, s.room_card_id,
              (SELECT COUNT(*)::int FROM suggestion_responses WHERE suggestion_id = s.id) AS response_count
       FROM suggestions s
       JOIN game_turns gt ON gt.id = s.turn_id
       WHERE s.game_id = $1
         AND gt.player_id = (SELECT current_turn_player_id FROM games WHERE id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM suggestion_responses WHERE suggestion_id = s.id AND card_shown_id IS NOT NULL
         )
       ORDER BY s.id DESC LIMIT 1`,
      [gameId],
    );
    if (!suggestion) return "No active suggestion to respond to.";

    const player = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2",
      [gameId, userId],
    );
    if (!player) return "You are not in this game.";

    const allPlayers = await t.any<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND is_eliminated = false ORDER BY turn_order",
      [gameId],
    );

    const responders = getResponders(allPlayers, suggestion.suggesting_player_id);
    const nextResponder = responders[suggestion.response_count];
    if (!nextResponder || nextResponder.id !== player.id) return "It is not your turn to respond.";

    if (cardId !== null) {
      const validCard = await t.oneOrNone<{ id: number }>(
        `SELECT id FROM game_player_cards
         WHERE player_id = $1 AND card_id = $2
           AND card_id IN ($3, $4, $5)`,
        [
          player.id,
          cardId,
          suggestion.suspect_card_id,
          suggestion.weapon_card_id,
          suggestion.room_card_id,
        ],
      );
      if (!validCard) return "You do not hold that card or it is not part of the suggestion.";
    }

    const responseOrder = suggestion.response_count + 1;
    await t.none(
      "INSERT INTO suggestion_responses (suggestion_id, responding_player_id, card_shown_id, response_order) VALUES ($1, $2, $3, $4)",
      [suggestion.id, player.id, cardId, responseOrder],
    );

    const done = cardId !== null || responseOrder >= responders.length;
    return { done };
  });
}

export async function makeAccusation(
  gameId: number,
  userId: number,
  suspectCardId: number,
  weaponCardId: number,
  roomCardId: number,
): Promise<{ correct: boolean; eliminated: boolean } | string> {
  return db.tx(async (t) => {
    const game = await t.oneOrNone<{ status: string; current_turn_player_id: number | null }>(
      "SELECT status, current_turn_player_id FROM games WHERE id = $1",
      [gameId],
    );
    if (!game || game.status !== "in_progress") return "Game not in progress.";

    const player = await t.oneOrNone<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2 AND is_eliminated = false",
      [gameId, userId],
    );
    if (!player) return "You are not an active player in this game.";

    const solution = await t.oneOrNone<{
      suspect_card_id: number;
      weapon_card_id: number;
      room_card_id: number;
    }>(
      "SELECT suspect_card_id, weapon_card_id, room_card_id FROM game_solutions WHERE game_id = $1",
      [gameId],
    );
    if (!solution) return "Game solution not found.";

    const correct =
      solution.suspect_card_id === suspectCardId &&
      solution.weapon_card_id === weaponCardId &&
      solution.room_card_id === roomCardId;

    if (correct) {
      await t.none("UPDATE games SET status = 'finished', winner_player_id = $1 WHERE id = $2", [
        player.id,
        gameId,
      ]);
      return { correct: true, eliminated: false };
    }

    await t.none("UPDATE game_players SET is_eliminated = true WHERE id = $1", [player.id]);

    const remaining = await t.one<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM game_players WHERE game_id = $1 AND is_eliminated = false",
      [gameId],
    );

    if (remaining.count === 1) {
      const lastPlayer = await t.one<{ id: number }>(
        "SELECT id FROM game_players WHERE game_id = $1 AND is_eliminated = false",
        [gameId],
      );
      await t.none("UPDATE games SET status = 'finished', winner_player_id = $1 WHERE id = $2", [
        lastPlayer.id,
        gameId,
      ]);
    } else if (game.current_turn_player_id === player.id) {
      const allPlayers = await t.any<{ id: number }>(
        "SELECT id FROM game_players WHERE game_id = $1 AND is_eliminated = false ORDER BY turn_order",
        [gameId],
      );
      const nextPlayer = allPlayers[0];
      if (nextPlayer) {
        await t.none("UPDATE games SET current_turn_player_id = $1 WHERE id = $2", [
          nextPlayer.id,
          gameId,
        ]);
      }
    }

    return { correct: false, eliminated: true };
  });
}

export async function advanceTurn(gameId: number): Promise<string | null> {
  return db.tx(async (t) => {
    const game = await t.oneOrNone<{ current_turn_player_id: number | null }>(
      "SELECT current_turn_player_id FROM games WHERE id = $1",
      [gameId],
    );
    if (!game?.current_turn_player_id) return "Game not found.";

    const allPlayers = await t.any<{ id: number }>(
      "SELECT id FROM game_players WHERE game_id = $1 AND is_eliminated = false ORDER BY turn_order",
      [gameId],
    );
    const currentIndex = allPlayers.findIndex((p) => p.id === game.current_turn_player_id);
    const nextPlayer = allPlayers[(currentIndex + 1) % allPlayers.length];
    if (!nextPlayer) return "Failed to advance turn.";

    await t.none("UPDATE games SET current_turn_player_id = $1 WHERE id = $2", [
      nextPlayer.id,
      gameId,
    ]);
    return null;
  });
}

export type GamePhase = "roll" | "move" | "suggest" | "respond" | "wait" | "done";

export interface CardInfo {
  id: number;
  type: string;
  name: string;
}

export interface PlayerState {
  id: number;
  username: string;
  character: string;
  turn_order: number;
  is_current_turn: boolean;
  is_eliminated: boolean;
  room: string | null;
  track_pos: number | null;
}

export interface TurnState {
  roll1: number | null;
  roll2: number | null;
  moved: boolean;
  suggested: boolean;
}

export interface SuggestionState {
  id: number;
  suggesting_username: string;
  suspect_name: string;
  weapon_name: string;
  room_name: string;
  my_turn_to_respond: boolean;
  eligible_cards: CardInfo[];
}

export interface WeaponPosition {
  weapon_name: string;
  room_name: string;
}

export interface FullGameState {
  game: GameDetail;
  phase: GamePhase;
  players: PlayerState[];
  myPlayerId: number | null;
  myCards: CardInfo[];
  currentTurn: TurnState | null;
  activeSuggestion: SuggestionState | null;
  allSuspects: CardInfo[];
  allWeapons: CardInfo[];
  allRooms: CardInfo[];
  weaponPositions: WeaponPosition[];
  winnerUsername: string | null;
}

async function fetchPlayerStates(
  gameId: number,
  currentTurnPlayerId: number | null,
): Promise<PlayerState[]> {
  return db.any<PlayerState>(
    `SELECT gp.id, u.username, gp.character, gp.turn_order,
            (gp.id = $2) AS is_current_turn,
            gp.is_eliminated,
            bp.room, bp.track_pos
     FROM game_players gp
     JOIN users u ON u.id = gp.user_id
     LEFT JOIN board_positions bp ON bp.player_id = gp.id
     WHERE gp.game_id = $1
     ORDER BY gp.turn_order`,
    [gameId, currentTurnPlayerId],
  );
}

async function fetchMyCards(gameId: number, playerId: number): Promise<CardInfo[]> {
  return db.any<CardInfo>(
    `SELECT c.id, c.type, c.name
     FROM game_player_cards gpc
     JOIN cards c ON c.id = gpc.card_id
     WHERE gpc.game_id = $1 AND gpc.player_id = $2
     ORDER BY c.type, c.name`,
    [gameId, playerId],
  );
}

async function fetchCurrentTurnState(gameId: number, playerId: number): Promise<TurnState | null> {
  const turn = await db.oneOrNone<{
    dice_roll_1: number | null;
    moved_to_track_pos: number | null;
    action_type: string;
  }>(
    `SELECT dice_roll_1, moved_to_track_pos, action_type
     FROM game_turns
     WHERE game_id = $1 AND player_id = $2
       AND turn_number = (SELECT MAX(turn_number) FROM game_turns WHERE game_id = $1)
     ORDER BY turn_number DESC LIMIT 1`,
    [gameId, playerId],
  );
  if (!turn) return null;
  return {
    roll1: turn.dice_roll_1,
    roll2: null,
    moved: turn.moved_to_track_pos !== null,
    suggested: turn.action_type === "suggestion",
  };
}

async function fetchActiveSuggestion(
  gameId: number,
  myPlayerId: number | null,
): Promise<SuggestionState | null> {
  const s = await db.oneOrNone<{
    id: number;
    suggesting_player_id: number;
    suggesting_username: string;
    suspect_name: string;
    weapon_name: string;
    room_name: string;
    suspect_card_id: number;
    weapon_card_id: number;
    room_card_id: number;
    response_count: number;
  }>(
    `SELECT s.id, s.suggesting_player_id,
            u.username AS suggesting_username,
            sc.name AS suspect_name, wc.name AS weapon_name, rc.name AS room_name,
            s.suspect_card_id, s.weapon_card_id, s.room_card_id,
            (SELECT COUNT(*)::int FROM suggestion_responses WHERE suggestion_id = s.id) AS response_count
     FROM suggestions s
     JOIN game_players gp ON gp.id = s.suggesting_player_id
     JOIN users u ON u.id = gp.user_id
     JOIN cards sc ON sc.id = s.suspect_card_id
     JOIN cards wc ON wc.id = s.weapon_card_id
     JOIN cards rc ON rc.id = s.room_card_id
     WHERE s.game_id = $1
       AND gp.id = (SELECT current_turn_player_id FROM games WHERE id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM suggestion_responses WHERE suggestion_id = s.id AND card_shown_id IS NOT NULL
       )
     ORDER BY s.id DESC LIMIT 1`,
    [gameId],
  );
  if (!s) return null;

  const allPlayers = await db.any<{ id: number }>(
    "SELECT id FROM game_players WHERE game_id = $1 AND is_eliminated = false ORDER BY turn_order",
    [gameId],
  );
  const responders = getResponders(allPlayers, s.suggesting_player_id);
  const nextResponder = responders[s.response_count];
  const myTurnToRespond = myPlayerId !== null && !!nextResponder && nextResponder.id === myPlayerId;

  const eligibleCards = myPlayerId
    ? await db.any<CardInfo>(
        `SELECT c.id, c.type, c.name FROM game_player_cards gpc
         JOIN cards c ON c.id = gpc.card_id
         WHERE gpc.player_id = $1 AND gpc.card_id IN ($2, $3, $4)`,
        [myPlayerId, s.suspect_card_id, s.weapon_card_id, s.room_card_id],
      )
    : [];

  return {
    id: s.id,
    suggesting_username: s.suggesting_username,
    suspect_name: s.suspect_name,
    weapon_name: s.weapon_name,
    room_name: s.room_name,
    my_turn_to_respond: myTurnToRespond,
    eligible_cards: eligibleCards,
  };
}

function computePhase(
  isMyTurn: boolean,
  turnState: TurnState | null,
  activeSuggestion: SuggestionState | null,
  myRoom: string | null,
): GamePhase {
  if (activeSuggestion) {
    return activeSuggestion.my_turn_to_respond ? "respond" : "wait";
  }
  if (!isMyTurn) return "wait";
  if (!turnState?.roll1) return "roll";
  if (!turnState.moved) return "move";
  if (!turnState.suggested && myRoom !== null) return "suggest";
  return "done";
}

async function fetchWinnerUsername(winnerPlayerId: number | null): Promise<string | null> {
  if (!winnerPlayerId) return null;
  const row = await db.oneOrNone<{ username: string }>(
    "SELECT u.username FROM game_players gp JOIN users u ON u.id = gp.user_id WHERE gp.id = $1",
    [winnerPlayerId],
  );
  return row?.username ?? null;
}

export async function getGameState(gameId: number, userId: number): Promise<FullGameState | null> {
  const game = await db.oneOrNone<GameDetail>(
    "SELECT id, status, max_players, created_by, current_turn_player_id, winner_player_id FROM games WHERE id = $1",
    [gameId],
  );
  if (!game) return null;

  const myPlayerRow = await db.oneOrNone<{ id: number }>(
    "SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2",
    [gameId, userId],
  );
  const myPlayerId = myPlayerRow?.id ?? null;
  const isMyTurn = myPlayerId !== null && myPlayerId === game.current_turn_player_id;

  const players = await fetchPlayerStates(gameId, game.current_turn_player_id);
  const myCards = myPlayerId ? await fetchMyCards(gameId, myPlayerId) : [];

  const currentTurn =
    game.status === "in_progress" && game.current_turn_player_id
      ? await fetchCurrentTurnState(gameId, game.current_turn_player_id)
      : null;

  const activeSuggestion =
    game.status === "in_progress" ? await fetchActiveSuggestion(gameId, myPlayerId) : null;

  const allSuspects = await db.any<CardInfo>(
    "SELECT id, type, name FROM cards WHERE type = 'suspect' ORDER BY name",
  );
  const allWeapons = await db.any<CardInfo>(
    "SELECT id, type, name FROM cards WHERE type = 'weapon' ORDER BY name",
  );
  const allRooms = await db.any<CardInfo>(
    "SELECT id, type, name FROM cards WHERE type = 'room' ORDER BY name",
  );

  const weaponPositions =
    game.status === "in_progress"
      ? await db.any<WeaponPosition>(
          `SELECT cw.name AS weapon_name, cr.name AS room_name
           FROM weapon_positions wp
           JOIN cards cw ON cw.id = wp.weapon_card_id
           JOIN cards cr ON cr.id = wp.room_card_id
           WHERE wp.game_id = $1
           ORDER BY cw.name`,
          [gameId],
        )
      : [];

  const winnerUsername = await fetchWinnerUsername(game.winner_player_id);

  const myRoom = players.find((p) => p.id === myPlayerId)?.room ?? null;
  const phase: GamePhase =
    game.status === "in_progress"
      ? computePhase(isMyTurn, currentTurn, activeSuggestion, myRoom)
      : "wait";

  return {
    game,
    phase,
    players,
    myPlayerId,
    myCards,
    currentTurn,
    activeSuggestion,
    allSuspects,
    allWeapons,
    allRooms,
    weaponPositions,
    winnerUsername,
  };
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

export async function deleteGame(gameId: number, userId: number): Promise<string | null> {
  return db.tx(async (t) => {
    const game = await t.oneOrNone<{ created_by: number }>(
      "SELECT created_by FROM games WHERE id = $1",
      [gameId],
    );
    if (!game) return "Game not found.";
    if (game.created_by !== userId) return "Only the host can delete this game.";

    await t.none("DELETE FROM game_messages WHERE game_id = $1", [gameId]);
    await t.none("DELETE FROM player_notes WHERE game_id = $1", [gameId]);
    await t.none("DELETE FROM weapon_positions WHERE game_id = $1", [gameId]);
    await t.none("DELETE FROM board_positions WHERE game_id = $1", [gameId]);
    await t.none("DELETE FROM game_player_cards WHERE game_id = $1", [gameId]);

    const suggestions = await t.any<{ id: number }>(
      "SELECT id FROM suggestions WHERE game_id = $1",
      [gameId],
    );
    for (const s of suggestions) {
      await t.none("DELETE FROM suggestion_responses WHERE suggestion_id = $1", [s.id]);
    }
    await t.none("DELETE FROM suggestions WHERE game_id = $1", [gameId]);
    await t.none("DELETE FROM game_turns WHERE game_id = $1", [gameId]);
    await t.none("DELETE FROM game_solutions WHERE game_id = $1", [gameId]);
    await t.none(
      "UPDATE games SET current_turn_player_id = NULL, winner_player_id = NULL WHERE id = $1",
      [gameId],
    );
    await t.none("DELETE FROM game_players WHERE game_id = $1", [gameId]);
    await t.none("DELETE FROM games WHERE id = $1", [gameId]);

    return null;
  });
}

export interface ChatMessage {
  id: number;
  username: string;
  content: string;
  created_at: string;
}

export async function sendChatMessage(
  gameId: number,
  userId: number,
  content: string,
): Promise<ChatMessage | string> {
  const player = await db.oneOrNone<{ id: number }>(
    "SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2",
    [gameId, userId],
  );
  if (!player) return "You are not in this game.";

  return db.one<ChatMessage>(
    `INSERT INTO game_messages (game_id, player_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, (SELECT username FROM users WHERE id = $2) AS username, content, created_at`,
    [gameId, player.id, content],
  );
}

export async function getChatMessages(gameId: number): Promise<ChatMessage[]> {
  return db.any<ChatMessage>(
    `SELECT gm.id, u.username, gm.content, gm.created_at
     FROM game_messages gm
     JOIN game_players gp ON gp.id = gm.player_id
     JOIN users u ON u.id = gp.user_id
     WHERE gm.game_id = $1
     ORDER BY gm.created_at ASC`,
    [gameId],
  );
}

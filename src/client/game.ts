interface CardInfo {
  id: number;
  type: string;
  name: string;
}
interface PlayerState {
  id: number;
  username: string;
  character: string;
  is_current_turn: boolean;
  is_eliminated: boolean;
  room: string | null;
  track_pos: number | null;
}
interface TurnState {
  roll1: number | null;
  roll2: number | null;
  moved: boolean;
  suggested: boolean;
}
interface SuggestionState {
  suggesting_username: string;
  suspect_name: string;
  weapon_name: string;
  room_name: string;
  my_turn_to_respond: boolean;
  eligible_cards: CardInfo[];
}
interface WeaponPosition {
  weapon_name: string;
  room_name: string;
}
interface GameState {
  game: { id: number; status: string };
  phase: string;
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

declare global {
  interface Window {
    __GAME_STATE__: GameState;
  }
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

const TRACK_POS_MAP = new Map<string, number>(
  TRACK.map((cell, i) => [`${String(cell.col)},${String(cell.row)}`, i]),
);

function reachableTrackPositions(startPos: number, roll: number): Set<number> {
  const reachable = new Set<number>();
  for (let i = 1; i <= roll; i++) {
    const pos = (startPos + i) % TRACK_LENGTH;
    if (TRACK[pos]?.room !== null) reachable.add(pos);
  }
  return reachable;
}

const BOARD_LAYOUT: (string | null)[][] = [
  ["Kitchen", null, null, null, "Ballroom", null, null, null, "Conservatory"],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ["Billiard Room", null, null, null, "Library", null, null, null, "Study"],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ["Hall", null, null, null, "Lounge", null, null, null, "Dining Room"],
];

const CHARACTER_TOKENS: Record<string, { css: string; initial: string }> = {
  "Miss Scarlett": { css: "token-scarlett", initial: "S" },
  "Colonel Mustard": { css: "token-mustard", initial: "M" },
  "Mrs. White": { css: "token-white", initial: "W" },
  "Reverend Green": { css: "token-green", initial: "G" },
  "Mrs. Peacock": { css: "token-peacock", initial: "P" },
  "Professor Plum": { css: "token-plum", initial: "Pl" },
};

const container = document.querySelector("[data-game-id]") as HTMLElement | null;
const gameId = container?.dataset["gameId"] ?? "";

async function apiPost(path: string, body?: unknown): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    alert(data.error ?? "Action failed");
  }
}

async function refreshState(): Promise<void> {
  const res = await fetch(`/api/games/${gameId}/state`);
  const state = (await res.json()) as GameState;
  renderState(state);
}

function renderPlayerList(players: PlayerState[]): void {
  const list = document.getElementById("player-list");
  if (!list) return;
  list.innerHTML = players
    .map(
      (p) => `
    <li class="player-row${p.is_current_turn ? " active-turn" : ""}${p.is_eliminated ? " eliminated" : ""}" data-player-id="${String(p.id)}">
      <div class="player-row-info">
        <span>${p.username}${p.is_eliminated ? " <span class='muted'>(out)</span>" : ""}</span>
        <span class="muted">${p.character}</span>
        ${p.room ? `<span class="muted room-label">${p.room}</span>` : ""}
      </div>
      ${p.is_current_turn ? `<span class="turn-badge">Turn</span>` : ""}
    </li>`,
    )
    .join("");
}

function buildBoard(state: GameState, reachablePositions?: Set<number>): string {
  const playersByTrackPos = new Map<number, PlayerState[]>();
  for (const p of state.players) {
    if (p.track_pos !== null) {
      const arr = playersByTrackPos.get(p.track_pos) ?? [];
      arr.push(p);
      playersByTrackPos.set(p.track_pos, arr);
    }
  }
  const weaponsByRoom: Record<string, string[]> = {};
  for (const wp of state.weaponPositions) {
    (weaponsByRoom[wp.room_name] ??= []).push(wp.weapon_name);
  }
  const me = state.players.find((p) => p.id === state.myPlayerId);

  const cells = BOARD_LAYOUT.flat()
    .map((_, idx) => {
      const col = idx % 9;
      const row = Math.floor(idx / 9);
      const trackIdx = TRACK_POS_MAP.get(`${String(col)},${String(row)}`);

      if (trackIdx === undefined) {
        return `<div class="board-dead-space"></div>`;
      }

      const cell = TRACK[trackIdx]!;
      const playersHere = playersByTrackPos.get(trackIdx) ?? [];
      const tokens = playersHere
        .map((p) => {
          const tok = CHARACTER_TOKENS[p.character] ?? { css: "", initial: "?" };
          return `<span class="token ${tok.css}${p.is_eliminated ? " token-eliminated" : ""}" title="${p.username} (${p.character})">${tok.initial}</span>`;
        })
        .join("");

      if (!cell.room) {
        const isCurrent = me?.track_pos === trackIdx;
        return `<div class="board-corridor${isCurrent ? " current-pos" : ""}">${tokens}</div>`;
      }

      const isReachable = reachablePositions?.has(trackIdx) ?? false;
      const isCurrent = me?.track_pos === trackIdx;
      const weapons = (weaponsByRoom[cell.room] ?? [])
        .map((w) => `<span class="weapon-token">${w}</span>`)
        .join("");
      return `<div class="board-room${isReachable ? " reachable" : ""}${isCurrent ? " current-pos" : ""}" data-track-pos="${String(trackIdx)}">
        <div class="board-room-name">${cell.room}</div>
        <div class="board-tokens">${tokens}</div>
        ${weapons ? `<div class="board-weapons">${weapons}</div>` : ""}
      </div>`;
    })
    .join("");

  return `<div class="board-grid">${cells}</div>`;
}

function buildRollPanel(): string {
  return `<div><h2>Your Turn</h2><p class="muted">Roll the dice to begin.</p></div>
          <div><button id="roll-btn">Roll Dice</button></div>`;
}

function buildMovePanel(state: GameState): string {
  const roll = state.currentTurn?.roll1 ?? 0;
  const me = state.players.find((p) => p.id === state.myPlayerId);
  const startPos = me?.track_pos ?? 0;
  const reachable = reachableTrackPositions(startPos, roll);
  const exactLanding = (startPos + roll) % TRACK_LENGTH;
  const exactIsRoom = TRACK[exactLanding]?.room !== null;

  if (reachable.size === 0 && !exactIsRoom) {
    return `<div><h2>Move</h2>
            <p class="muted">You rolled <strong>${String(roll)}</strong>. No rooms in range — you'll land in a corridor.</p></div>
            <div><button id="advance-btn">Advance</button></div>`;
  }

  return `<div><h2>Move</h2>
          <p class="muted">You rolled <strong>${String(roll)}</strong>. Click a highlighted room on the board to move there.</p></div>`;
}

function buildDonePanel(): string {
  return `<div><h2>Turn Complete</h2><p class="muted">End your turn to pass to the next player.</p></div>
          <div><button id="end-turn-btn" class="btn-secondary">End Turn</button></div>`;
}

function buildAccuseSection(state: GameState): string {
  const suspects = state.allSuspects
    .map((s) => `<option value="${String(s.id)}">${s.name}</option>`)
    .join("");
  const weapons = state.allWeapons
    .map((w) => `<option value="${String(w.id)}">${w.name}</option>`)
    .join("");
  const rooms = state.allRooms
    .map((r) => `<option value="${String(r.id)}">${r.name}</option>`)
    .join("");
  return `<details class="accuse-section">
            <summary class="muted">Make an Accusation</summary>
            <div class="stack">
              <p class="muted">Warning: a wrong accusation eliminates you.</p>
              <div class="form-group"><label>Suspect</label><select id="accuse-suspect-select">${suspects}</select></div>
              <div class="form-group"><label>Weapon</label><select id="accuse-weapon-select">${weapons}</select></div>
              <div class="form-group"><label>Room</label><select id="accuse-room-select">${rooms}</select></div>
              <div><button id="accuse-btn" class="btn-danger">Accuse</button></div>
            </div>
          </details>`;
}

function buildSuggestPanel(state: GameState): string {
  const me = state.players.find((p) => p.id === state.myPlayerId);
  const suspects = state.allSuspects
    .map((s) => `<option value="${String(s.id)}">${s.name}</option>`)
    .join("");
  const weapons = state.allWeapons
    .map((w) => `<option value="${String(w.id)}">${w.name}</option>`)
    .join("");
  return `<div><h2>Make a Suggestion</h2>
          <p class="muted">You are in the <strong>${me?.room ?? "?"}</strong>.</p></div>
          <div class="form-group"><label>Suspect</label><select id="suspect-select">${suspects}</select></div>
          <div class="form-group"><label>Weapon</label><select id="weapon-select">${weapons}</select></div>
          <div class="action-row">
            <button id="suggest-btn">Make Suggestion</button>
            <button id="end-turn-btn" class="btn-secondary">End Turn</button>
          </div>
          ${buildAccuseSection(state)}`;
}

function buildRespondPanel(s: SuggestionState): string {
  const cardBtns = s.eligible_cards
    .map((c) => `<button class="show-card-btn" data-card-id="${String(c.id)}">${c.name}</button>`)
    .join("");
  return `<div><h2>Respond to Suggestion</h2>
          <p><strong>${s.suggesting_username}</strong> suggests <strong>${s.suspect_name}</strong>
          in the <strong>${s.room_name}</strong> with the <strong>${s.weapon_name}</strong>.</p></div>
          ${s.eligible_cards.length > 0 ? `<div><p class="muted">Show a matching card:</p><div class="action-row">${cardBtns}</div></div>` : ""}
          <div><button id="pass-btn" class="btn-secondary">Pass</button></div>`;
}

function buildWaitPanel(state: GameState): string {
  const current = state.players.find((p) => p.is_current_turn);
  if (state.activeSuggestion) {
    const s = state.activeSuggestion;
    return `<div><h2>Waiting</h2><p class="muted"><strong>${s.suggesting_username}</strong> suggested <strong>${s.suspect_name}</strong> in the <strong>${s.room_name}</strong>. Waiting for responses...</p></div>`;
  }
  return `<div><h2>Waiting</h2><p class="muted">Waiting for <strong>${current?.username ?? "..."}</strong>.</p></div>`;
}

function buildFinishedPanel(state: GameState): string {
  const me = state.players.find((p) => p.id === state.myPlayerId);
  const won = state.winnerUsername === me?.username;
  return `<div><h2>${won ? "You Win!" : "Game Over"}</h2>
          <p class="muted"><strong>${state.winnerUsername ?? "Someone"}</strong> solved the mystery.</p></div>`;
}

function buildActionPanel(state: GameState): string {
  if (state.game.status === "finished") return buildFinishedPanel(state);
  switch (state.phase) {
    case "roll":
      return buildRollPanel();
    case "move":
      return buildMovePanel(state);
    case "suggest":
      return buildSuggestPanel(state);
    case "respond":
      return state.activeSuggestion
        ? buildRespondPanel(state.activeSuggestion)
        : buildWaitPanel(state);
    case "done":
      return buildDonePanel();
    default:
      return buildWaitPanel(state);
  }
}

function attachListeners(state: GameState): void {
  document.getElementById("roll-btn")?.addEventListener("click", () => {
    void apiPost(`/api/games/${gameId}/roll`).then(() => void refreshState());
  });
  document.getElementById("advance-btn")?.addEventListener("click", () => {
    const me = state.players.find((p) => p.id === state.myPlayerId);
    const startPos = me?.track_pos ?? 0;
    const roll = state.currentTurn?.roll1 ?? 0;
    const targetTrackPos = (startPos + roll) % TRACK_LENGTH;
    void apiPost(`/api/games/${gameId}/move`, { trackPos: targetTrackPos }).then(
      () => void refreshState(),
    );
  });
  document.getElementById("suggest-btn")?.addEventListener("click", () => {
    const suspectCardId = Number(
      (document.getElementById("suspect-select") as HTMLSelectElement | null)?.value,
    );
    const weaponCardId = Number(
      (document.getElementById("weapon-select") as HTMLSelectElement | null)?.value,
    );
    void apiPost(`/api/games/${gameId}/suggest`, { suspectCardId, weaponCardId }).then(
      () => void refreshState(),
    );
  });
  document.getElementById("end-turn-btn")?.addEventListener("click", () => {
    void apiPost(`/api/games/${gameId}/end-turn`).then(() => void refreshState());
  });
  document.getElementById("pass-btn")?.addEventListener("click", () => {
    void apiPost(`/api/games/${gameId}/respond`, { cardId: null }).then(() => void refreshState());
  });
  document.getElementById("accuse-btn")?.addEventListener("click", () => {
    const suspectCardId = Number(
      (document.getElementById("accuse-suspect-select") as HTMLSelectElement | null)?.value,
    );
    const weaponCardId = Number(
      (document.getElementById("accuse-weapon-select") as HTMLSelectElement | null)?.value,
    );
    const roomCardId = Number(
      (document.getElementById("accuse-room-select") as HTMLSelectElement | null)?.value,
    );
    void apiPost(`/api/games/${gameId}/accuse`, { suspectCardId, weaponCardId, roomCardId }).then(
      () => void refreshState(),
    );
  });
  document.querySelectorAll(".show-card-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cardId = Number((btn as HTMLElement).dataset["cardId"]);
      void apiPost(`/api/games/${gameId}/respond`, { cardId }).then(() => void refreshState());
    });
  });
  void state;
}

type NotepadStatus = "mine" | "seen" | null;
type NotepadData = Record<number, NotepadStatus>;

function loadNotepad(): NotepadData {
  try {
    const raw = localStorage.getItem(`notepad_${gameId}`);
    return raw ? (JSON.parse(raw) as NotepadData) : {};
  } catch {
    return {};
  }
}

function saveNotepad(data: NotepadData): void {
  localStorage.setItem(`notepad_${gameId}`, JSON.stringify(data));
}

function syncHandToNotepad(myCards: CardInfo[]): void {
  const data = loadNotepad();
  for (const card of myCards) {
    data[card.id] = "mine";
  }
  saveNotepad(data);
}

function renderNotepad(state: GameState): void {
  const el = document.getElementById("notepad");
  if (!el) return;

  const data = loadNotepad();
  const groups: [string, CardInfo[]][] = [
    ["Suspects", state.allSuspects],
    ["Weapons", state.allWeapons],
    ["Rooms", state.allRooms],
  ];

  el.innerHTML = groups
    .map(([label, cards]) => {
      const rows = cards
        .map((c) => {
          const status = data[c.id] ?? null;
          const isMine = status === "mine";
          const isSeen = status === "seen";
          return `<li class="notepad-row${isMine ? " notepad-mine" : isSeen ? " notepad-seen" : ""}"
                      data-card-id="${String(c.id)}"
                      data-locked="${isMine ? "1" : "0"}">
                    <span class="notepad-name">${c.name}</span>
                    <span class="notepad-status">${isMine ? "mine" : isSeen ? "seen" : ""}</span>
                  </li>`;
        })
        .join("");
      return `<div class="notepad-group"><h3 class="notepad-group-label">${label}</h3><ul class="notepad-list">${rows}</ul></div>`;
    })
    .join("");

  el.querySelectorAll(".notepad-row").forEach((row) => {
    row.addEventListener("click", () => {
      if ((row as HTMLElement).dataset["locked"] === "1") return;
      const cardId = Number((row as HTMLElement).dataset["cardId"]);
      const current = loadNotepad();
      current[cardId] = current[cardId] === "seen" ? null : "seen";
      saveNotepad(current);
      renderNotepad(state);
    });
  });
}

function renderState(state: GameState): void {
  const panel = document.getElementById("action-panel");
  if (panel) {
    panel.innerHTML = buildActionPanel(state);
    attachListeners(state);
  }

  const boardEl = document.getElementById("game-board");
  if (boardEl) {
    let reachable: Set<number> | undefined;
    if (state.phase === "move") {
      const me = state.players.find((p) => p.id === state.myPlayerId);
      const startPos = me?.track_pos ?? 0;
      const roll = state.currentTurn?.roll1 ?? 0;
      reachable = reachableTrackPositions(startPos, roll);
    }
    boardEl.innerHTML = buildBoard(state, reachable);

    if (state.phase === "move" && reachable && reachable.size > 0) {
      boardEl.querySelectorAll<HTMLElement>(".board-room.reachable").forEach((el) => {
        el.addEventListener("click", () => {
          const trackPos = Number(el.dataset["trackPos"]);
          void apiPost(`/api/games/${gameId}/move`, { trackPos }).then(() => void refreshState());
        });
      });
    }
  }

  renderPlayerList(state.players);
  syncHandToNotepad(state.myCards);
  renderNotepad(state);
}

interface ChatMessage {
  id: number;
  username: string;
  content: string;
  created_at: string;
}

function appendChatMessage(msg: ChatMessage): void {
  const list = document.getElementById("chat-messages");
  if (!list) return;
  const li = document.createElement("li");
  li.className = "chat-message";
  li.innerHTML = `<span class="chat-username">${msg.username}</span><span class="chat-content">${msg.content}</span>`;
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
}

async function loadChatHistory(): Promise<void> {
  const res = await fetch(`/api/games/${gameId}/chat`);
  const messages = (await res.json()) as ChatMessage[];
  const list = document.getElementById("chat-messages");
  if (list) list.innerHTML = "";
  for (const msg of messages) {
    appendChatMessage(msg);
  }
}

function attachChatListeners(): void {
  const input = document.getElementById("chat-input") as HTMLInputElement | null;
  const btn = document.getElementById("chat-send-btn");

  const send = (): void => {
    const content = input?.value.trim() ?? "";
    if (!content) return;
    if (input) input.value = "";
    void fetch(`/api/games/${gameId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  };

  btn?.addEventListener("click", send);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
}

function connectSse(): void {
  const source = new EventSource(`/api/games/${gameId}/events`);
  source.addEventListener("state", () => {
    void refreshState();
  });
  source.addEventListener("chat", (e) => {
    const msg = JSON.parse((e as MessageEvent<string>).data) as ChatMessage;
    appendChatMessage(msg);
  });
  source.addEventListener("error", () => {
    source.close();
    setTimeout(connectSse, 3000);
  });
}

const initialState = window.__GAME_STATE__;
if (initialState) {
  renderState(initialState);
  if (initialState.game.status === "in_progress") {
    void loadChatHistory();
    attachChatListeners();
    connectSse();
  }
}

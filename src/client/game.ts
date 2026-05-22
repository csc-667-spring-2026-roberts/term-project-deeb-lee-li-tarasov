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
  room: string | null;
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
  winnerUsername: string | null;
}

declare global {
  interface Window {
    __GAME_STATE__: GameState;
  }
}

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
    <li class="player-row${p.is_current_turn ? " active-turn" : ""}" data-player-id="${String(p.id)}">
      <div class="player-row-info">
        <span>${p.username}</span>
        <span class="muted">${p.character}</span>
        ${p.room ? `<span class="muted room-label">${p.room}</span>` : ""}
      </div>
      ${p.is_current_turn ? `<span class="turn-badge">Turn</span>` : ""}
    </li>`,
    )
    .join("");
}

function buildRollPanel(): string {
  return `<div><h2>Your Turn</h2><p class="muted">Roll the dice to begin.</p></div>
          <div><button id="roll-btn">Roll Dice</button></div>`;
}

function buildMovePanel(state: GameState): string {
  const rooms = [
    "Kitchen",
    "Ballroom",
    "Conservatory",
    "Billiard Room",
    "Library",
    "Study",
    "Hall",
    "Lounge",
    "Dining Room",
  ];
  const opts = rooms.map((r) => `<option value="${r}">${r}</option>`).join("");
  const total = (state.currentTurn?.roll1 ?? 0) + (state.currentTurn?.roll2 ?? 0);
  return `<div><h2>Choose a Room</h2>
          <p class="muted">You rolled <strong>${String(state.currentTurn?.roll1)} + ${String(state.currentTurn?.roll2)} = ${String(total)}</strong>.</p></div>
          <div class="form-group"><label>Room</label><select id="room-select">${opts}</select></div>
          <div><button id="move-btn">Move</button></div>`;
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
    default:
      return buildWaitPanel(state);
  }
}

function attachListeners(state: GameState): void {
  document.getElementById("roll-btn")?.addEventListener("click", () => {
    void apiPost(`/api/games/${gameId}/roll`).then(() => void refreshState());
  });
  document.getElementById("move-btn")?.addEventListener("click", () => {
    const room = (document.getElementById("room-select") as HTMLSelectElement | null)?.value ?? "";
    void apiPost(`/api/games/${gameId}/move`, { room }).then(() => void refreshState());
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

function renderState(state: GameState): void {
  const panel = document.getElementById("action-panel");
  if (panel) {
    panel.innerHTML = buildActionPanel(state);
    attachListeners(state);
  }
  renderPlayerList(state.players);
}

function connectSse(): void {
  const source = new EventSource(`/api/games/${gameId}/events`);
  source.addEventListener("state", () => {
    void refreshState();
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
    connectSse();
  }
}

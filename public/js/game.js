// src/client/game.ts
var BOARD_LAYOUT = [
  ["Kitchen", null, null, null, "Ballroom", null, null, null, "Conservatory"],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ["Billiard Room", null, null, null, "Library", null, null, null, "Study"],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  ["Hall", null, null, null, "Lounge", null, null, null, "Dining Room"]
];
var CHARACTER_TOKENS = {
  "Miss Scarlett": { css: "token-scarlett", initial: "S" },
  "Colonel Mustard": { css: "token-mustard", initial: "M" },
  "Mrs. White": { css: "token-white", initial: "W" },
  "Reverend Green": { css: "token-green", initial: "G" },
  "Mrs. Peacock": { css: "token-peacock", initial: "P" },
  "Professor Plum": { css: "token-plum", initial: "Pl" }
};
var container = document.querySelector("[data-game-id]");
var gameId = container?.dataset["gameId"] ?? "";
async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: body !== void 0 ? { "Content-Type": "application/json" } : {},
    body: body !== void 0 ? JSON.stringify(body) : void 0
  });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error ?? "Action failed");
  }
}
async function refreshState() {
  const res = await fetch(`/api/games/${gameId}/state`);
  const state = await res.json();
  renderState(state);
}
function renderPlayerList(players) {
  const list = document.getElementById("player-list");
  if (!list) return;
  list.innerHTML = players.map(
    (p) => `
    <li class="player-row${p.is_current_turn ? " active-turn" : ""}${p.is_eliminated ? " eliminated" : ""}" data-player-id="${String(p.id)}">
      <div class="player-row-info">
        <span>${p.username}${p.is_eliminated ? " <span class='muted'>(out)</span>" : ""}</span>
        <span class="muted">${p.character}</span>
        ${p.room ? `<span class="muted room-label">${p.room}</span>` : ""}
      </div>
      ${p.is_current_turn ? `<span class="turn-badge">Turn</span>` : ""}
    </li>`
  ).join("");
}
function buildBoard(state) {
  var _a, _b;
  const playersByRoom = {};
  for (const p of state.players) {
    if (p.room) {
      (playersByRoom[_a = p.room] ?? (playersByRoom[_a] = [])).push(p);
    }
  }
  const weaponsByRoom = {};
  for (const wp of state.weaponPositions) {
    (weaponsByRoom[_b = wp.room_name] ?? (weaponsByRoom[_b] = [])).push(wp.weapon_name);
  }
  const cells = BOARD_LAYOUT.flat().map((room) => {
    if (!room) return `<div class="board-corridor"></div>`;
    const tokens = (playersByRoom[room] ?? []).map((p) => {
      const tok = CHARACTER_TOKENS[p.character] ?? { css: "token-default", initial: "?" };
      return `<span class="token ${tok.css}${p.is_eliminated ? " token-eliminated" : ""}" title="${p.username} (${p.character})">${tok.initial}</span>`;
    }).join("");
    const weapons = (weaponsByRoom[room] ?? []).map((w) => `<span class="weapon-token">${w}</span>`).join("");
    return `<div class="board-room">
        <div class="board-room-name">${room}</div>
        <div class="board-tokens">${tokens}</div>
        ${weapons ? `<div class="board-weapons">${weapons}</div>` : ""}
      </div>`;
  }).join("");
  return `<div class="board-grid">${cells}</div>`;
}
function buildRollPanel() {
  return `<div><h2>Your Turn</h2><p class="muted">Roll the dice to begin.</p></div>
          <div><button id="roll-btn">Roll Dice</button></div>`;
}
function buildMovePanel(state) {
  const rooms = [
    "Kitchen",
    "Ballroom",
    "Conservatory",
    "Billiard Room",
    "Library",
    "Study",
    "Hall",
    "Lounge",
    "Dining Room"
  ];
  const opts = rooms.map((r) => `<option value="${r}">${r}</option>`).join("");
  const total = (state.currentTurn?.roll1 ?? 0) + (state.currentTurn?.roll2 ?? 0);
  return `<div><h2>Choose a Room</h2>
          <p class="muted">You rolled <strong>${String(state.currentTurn?.roll1)} + ${String(state.currentTurn?.roll2)} = ${String(total)}</strong>.</p></div>
          <div class="form-group"><label>Room</label><select id="room-select">${opts}</select></div>
          <div><button id="move-btn">Move</button></div>`;
}
function buildAccuseSection(state) {
  const suspects = state.allSuspects.map((s) => `<option value="${String(s.id)}">${s.name}</option>`).join("");
  const weapons = state.allWeapons.map((w) => `<option value="${String(w.id)}">${w.name}</option>`).join("");
  const rooms = state.allRooms.map((r) => `<option value="${String(r.id)}">${r.name}</option>`).join("");
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
function buildSuggestPanel(state) {
  const me = state.players.find((p) => p.id === state.myPlayerId);
  const suspects = state.allSuspects.map((s) => `<option value="${String(s.id)}">${s.name}</option>`).join("");
  const weapons = state.allWeapons.map((w) => `<option value="${String(w.id)}">${w.name}</option>`).join("");
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
function buildRespondPanel(s) {
  const cardBtns = s.eligible_cards.map((c) => `<button class="show-card-btn" data-card-id="${String(c.id)}">${c.name}</button>`).join("");
  return `<div><h2>Respond to Suggestion</h2>
          <p><strong>${s.suggesting_username}</strong> suggests <strong>${s.suspect_name}</strong>
          in the <strong>${s.room_name}</strong> with the <strong>${s.weapon_name}</strong>.</p></div>
          ${s.eligible_cards.length > 0 ? `<div><p class="muted">Show a matching card:</p><div class="action-row">${cardBtns}</div></div>` : ""}
          <div><button id="pass-btn" class="btn-secondary">Pass</button></div>`;
}
function buildWaitPanel(state) {
  const current = state.players.find((p) => p.is_current_turn);
  if (state.activeSuggestion) {
    const s = state.activeSuggestion;
    return `<div><h2>Waiting</h2><p class="muted"><strong>${s.suggesting_username}</strong> suggested <strong>${s.suspect_name}</strong> in the <strong>${s.room_name}</strong>. Waiting for responses...</p></div>`;
  }
  return `<div><h2>Waiting</h2><p class="muted">Waiting for <strong>${current?.username ?? "..."}</strong>.</p></div>`;
}
function buildFinishedPanel(state) {
  const me = state.players.find((p) => p.id === state.myPlayerId);
  const won = state.winnerUsername === me?.username;
  return `<div><h2>${won ? "You Win!" : "Game Over"}</h2>
          <p class="muted"><strong>${state.winnerUsername ?? "Someone"}</strong> solved the mystery.</p></div>`;
}
function buildActionPanel(state) {
  if (state.game.status === "finished") return buildFinishedPanel(state);
  switch (state.phase) {
    case "roll":
      return buildRollPanel();
    case "move":
      return buildMovePanel(state);
    case "suggest":
      return buildSuggestPanel(state);
    case "respond":
      return state.activeSuggestion ? buildRespondPanel(state.activeSuggestion) : buildWaitPanel(state);
    default:
      return buildWaitPanel(state);
  }
}
function attachListeners(state) {
  document.getElementById("roll-btn")?.addEventListener("click", () => {
    void apiPost(`/api/games/${gameId}/roll`).then(() => void refreshState());
  });
  document.getElementById("move-btn")?.addEventListener("click", () => {
    const room = document.getElementById("room-select")?.value ?? "";
    void apiPost(`/api/games/${gameId}/move`, { room }).then(() => void refreshState());
  });
  document.getElementById("suggest-btn")?.addEventListener("click", () => {
    const suspectCardId = Number(
      document.getElementById("suspect-select")?.value
    );
    const weaponCardId = Number(
      document.getElementById("weapon-select")?.value
    );
    void apiPost(`/api/games/${gameId}/suggest`, { suspectCardId, weaponCardId }).then(
      () => void refreshState()
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
      document.getElementById("accuse-suspect-select")?.value
    );
    const weaponCardId = Number(
      document.getElementById("accuse-weapon-select")?.value
    );
    const roomCardId = Number(
      document.getElementById("accuse-room-select")?.value
    );
    void apiPost(`/api/games/${gameId}/accuse`, { suspectCardId, weaponCardId, roomCardId }).then(
      () => void refreshState()
    );
  });
  document.querySelectorAll(".show-card-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cardId = Number(btn.dataset["cardId"]);
      void apiPost(`/api/games/${gameId}/respond`, { cardId }).then(() => void refreshState());
    });
  });
  void state;
}
function loadNotepad() {
  try {
    const raw = localStorage.getItem(`notepad_${gameId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveNotepad(data) {
  localStorage.setItem(`notepad_${gameId}`, JSON.stringify(data));
}
function syncHandToNotepad(myCards) {
  const data = loadNotepad();
  for (const card of myCards) {
    data[card.id] = "mine";
  }
  saveNotepad(data);
}
function renderNotepad(state) {
  const el = document.getElementById("notepad");
  if (!el) return;
  const data = loadNotepad();
  const groups = [
    ["Suspects", state.allSuspects],
    ["Weapons", state.allWeapons],
    ["Rooms", state.allRooms]
  ];
  el.innerHTML = groups.map(([label, cards]) => {
    const rows = cards.map((c) => {
      const status = data[c.id] ?? null;
      const isMine = status === "mine";
      const isSeen = status === "seen";
      return `<li class="notepad-row${isMine ? " notepad-mine" : isSeen ? " notepad-seen" : ""}"
                      data-card-id="${String(c.id)}"
                      data-locked="${isMine ? "1" : "0"}">
                    <span class="notepad-name">${c.name}</span>
                    <span class="notepad-status">${isMine ? "mine" : isSeen ? "seen" : ""}</span>
                  </li>`;
    }).join("");
    return `<div class="notepad-group"><h3 class="notepad-group-label">${label}</h3><ul class="notepad-list">${rows}</ul></div>`;
  }).join("");
  el.querySelectorAll(".notepad-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.dataset["locked"] === "1") return;
      const cardId = Number(row.dataset["cardId"]);
      const current = loadNotepad();
      current[cardId] = current[cardId] === "seen" ? null : "seen";
      saveNotepad(current);
      renderNotepad(state);
    });
  });
}
function renderState(state) {
  const panel = document.getElementById("action-panel");
  if (panel) {
    panel.innerHTML = buildActionPanel(state);
    attachListeners(state);
  }
  const boardEl = document.getElementById("game-board");
  if (boardEl) {
    boardEl.innerHTML = buildBoard(state);
  }
  renderPlayerList(state.players);
  syncHandToNotepad(state.myCards);
  renderNotepad(state);
}
function appendChatMessage(msg) {
  const list = document.getElementById("chat-messages");
  if (!list) return;
  const li = document.createElement("li");
  li.className = "chat-message";
  li.innerHTML = `<span class="chat-username">${msg.username}</span><span class="chat-content">${msg.content}</span>`;
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
}
async function loadChatHistory() {
  const res = await fetch(`/api/games/${gameId}/chat`);
  const messages = await res.json();
  const list = document.getElementById("chat-messages");
  if (list) list.innerHTML = "";
  for (const msg of messages) {
    appendChatMessage(msg);
  }
}
function attachChatListeners() {
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("chat-send-btn");
  const send = () => {
    const content = input?.value.trim() ?? "";
    if (!content) return;
    if (input) input.value = "";
    void fetch(`/api/games/${gameId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
  };
  btn?.addEventListener("click", send);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
}
function connectSse() {
  const source = new EventSource(`/api/games/${gameId}/events`);
  source.addEventListener("state", () => {
    void refreshState();
  });
  source.addEventListener("chat", (e) => {
    const msg = JSON.parse(e.data);
    appendChatMessage(msg);
  });
  source.addEventListener("error", () => {
    source.close();
    setTimeout(connectSse, 3e3);
  });
}
var initialState = window.__GAME_STATE__;
if (initialState) {
  renderState(initialState);
  if (initialState.game.status === "in_progress") {
    void loadChatHistory();
    attachChatListeners();
    connectSse();
  }
}
//# sourceMappingURL=game.js.map

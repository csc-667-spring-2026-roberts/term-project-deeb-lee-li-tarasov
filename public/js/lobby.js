// src/client/lobby.ts
var button = document.getElementById("load-users");
var list = document.getElementById("user-list");
var template = document.getElementById("user-row");
var statusEl = document.getElementById("sse-status");
var store = /* @__PURE__ */ (() => {
  let state = { connected: false };
  const listeners = /* @__PURE__ */ new Set();
  return {
    getState: () => state,
    setState: (patch) => {
      state = { ...state, ...patch };
      for (const listener of listeners) {
        listener(state);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    }
  };
})();
var renderState = (state) => {
  if (statusEl) {
    statusEl.textContent = state.connected ? "Connected" : "Reconnecting...";
  }
};
store.subscribe(renderState);
function loadOnlineUsers() {
  if (!button || !list || !template) return;
  void fetch("/api/lobby/users").then((res) => res.json()).then((users) => {
    list.replaceChildren();
    for (const username of users) {
      const clone = template.content.cloneNode(true);
      const nameEl = clone.querySelector("[data-username]");
      if (nameEl) nameEl.textContent = username;
      list.appendChild(clone);
    }
  });
}
if (button) {
  button.addEventListener("click", loadOnlineUsers);
}
var connectSse = () => {
  const source = new EventSource("/api/lobby/connect");
  source.addEventListener("open", () => {
    store.setState({ connected: true });
    loadOnlineUsers();
  });
  source.addEventListener("state", () => {
    loadOnlineUsers();
  });
  source.addEventListener("error", () => {
    store.setState({ connected: false });
  });
};
connectSse();
//# sourceMappingURL=lobby.js.map

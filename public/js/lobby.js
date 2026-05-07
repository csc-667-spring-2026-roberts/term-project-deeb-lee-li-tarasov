// src/client/lobby.ts
var button = document.getElementById("load-users");
var list = document.getElementById("user-list");
var template = document.getElementById("user-row");
var statusEl = document.getElementById("sse-status");
var eventsEl = document.getElementById("sse-events");
var store = /* @__PURE__ */ (() => {
  let state = { connected: false, lastEvent: "", payload: null };
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
  if (eventsEl && state.lastEvent) {
    const item = document.createElement("li");
    item.textContent = `${(/* @__PURE__ */ new Date()).toLocaleTimeString()} \u2014 ${state.lastEvent}: ${JSON.stringify(state.payload)}`;
    eventsEl.prepend(item);
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
  source.addEventListener("connected", (event) => {
    store.setState({
      connected: true,
      lastEvent: "connected",
      payload: JSON.parse(event.data)
    });
  });
  source.addEventListener("state", (event) => {
    store.setState({
      connected: true,
      lastEvent: "state",
      payload: JSON.parse(event.data)
    });
    loadOnlineUsers();
  });
  source.addEventListener("error", () => {
    store.setState({ connected: false, lastEvent: "error", payload: null });
  });
};
connectSse();
//# sourceMappingURL=lobby.js.map

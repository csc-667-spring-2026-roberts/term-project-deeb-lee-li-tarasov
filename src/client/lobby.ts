interface LobbyState {
  connected: boolean;
  lastEvent: string;
  payload: unknown;
}

type Listener = (state: LobbyState) => void;

interface Store {
  getState: () => LobbyState;
  setState: (patch: Partial<LobbyState>) => void;
  subscribe: (listener: Listener) => () => void;
}

const button = document.getElementById("load-users") as HTMLButtonElement | null;
const list = document.getElementById("user-list") as HTMLUListElement | null;
const template = document.getElementById("user-row") as HTMLTemplateElement | null;
const statusEl = document.getElementById("sse-status");
const eventsEl = document.getElementById("sse-events");

const store = ((): Store => {
  let state: LobbyState = { connected: false, lastEvent: "", payload: null };
  const listeners = new Set<Listener>();

  return {
    getState: (): LobbyState => state,
    setState: (patch: Partial<LobbyState>): void => {
      state = { ...state, ...patch };
      for (const listener of listeners) {
        listener(state);
      }
    },
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

const renderState = (state: LobbyState): void => {
  if (statusEl) {
    statusEl.textContent = state.connected ? "Connected" : "Reconnecting...";
  }

  if (eventsEl && state.lastEvent) {
    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString()} — ${state.lastEvent}: ${JSON.stringify(state.payload)}`;
    eventsEl.prepend(item);
  }
};

store.subscribe(renderState);

function loadOnlineUsers(): void {
  if (!button || !list || !template) return;
  void fetch("/api/lobby/users")
    .then((res) => res.json())
    .then((users) => {
      list.replaceChildren();
      for (const username of users as string[]) {
        const clone = template.content.cloneNode(true) as DocumentFragment;
        const nameEl = clone.querySelector("[data-username]");
        if (nameEl) nameEl.textContent = username;
        list.appendChild(clone);
      }
    });
}

if (button) {
  button.addEventListener("click", loadOnlineUsers);
}

const connectSse = (): void => {
  const source = new EventSource("/api/lobby/connect");

  source.addEventListener("open", () => {
    store.setState({ connected: true });
    loadOnlineUsers();
  });

  source.addEventListener("connected", (event) => {
    store.setState({
      connected: true,
      lastEvent: "connected",
      payload: JSON.parse((event as MessageEvent<string>).data) as unknown,
    });
  });

  source.addEventListener("state", (event) => {
    store.setState({
      connected: true,
      lastEvent: "state",
      payload: JSON.parse((event as MessageEvent<string>).data) as unknown,
    });
    loadOnlineUsers();
  });

  source.addEventListener("error", () => {
    store.setState({ connected: false, lastEvent: "error", payload: null });
  });
};

connectSse();

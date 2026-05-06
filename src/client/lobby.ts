interface User {
  username: string;
  email: string;
}

interface LobbyState {
  connected: boolean;
  room: string;
  lastEvent: string;
  payload: unknown;
}

type Listener = (state: LobbyState) => void;

const button = document.getElementById("load-users") as HTMLButtonElement | null;
const list = document.getElementById("user-list") as HTMLUListElement | null;
const template = document.getElementById("user-row") as HTMLTemplateElement | null;
const statusEl = document.getElementById("sse-status");
const eventsEl = document.getElementById("sse-events");

const store = (() => {
  let state: LobbyState = {
    connected: false,
    room: "lobby",
    lastEvent: "none",
    payload: null,
  };
  const listeners = new Set<Listener>();

  return {
    getState: (): LobbyState => state,
    setState: (patch: Partial<LobbyState>): void => {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state);
    },
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
})();

const renderState = (state: LobbyState): void => {
  if (statusEl) {
    statusEl.textContent = state.connected
      ? `Connected to ${state.room}`
      : `Reconnecting to ${state.room}...`;
  }

  if (eventsEl) {
    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString()} ${state.lastEvent}: ${JSON.stringify(
      state.payload,
    )}`;
    eventsEl.prepend(item);
  }
};

store.subscribe(renderState);

if (button && list && template) {
  button.addEventListener("click", () => {
    void fetch("/api/users")
      .then((res) => res.json())
      .then((users) => {
        list.replaceChildren();
        for (const user of users as User[]) {
          const clone = template.content.cloneNode(true) as DocumentFragment;
          const nameEl = clone.querySelector("[data-username]");
          const emailEl = clone.querySelector("[data-email]");
          if (nameEl) nameEl.textContent = user.username;
          if (emailEl) emailEl.textContent = user.email;
          list.appendChild(clone);
        }
      });
  });
}

const connectSse = (): void => {
  const source = new EventSource(`/api/sse?room=${encodeURIComponent(store.getState().room)}`);

  source.addEventListener("open", () => {
    store.setState({ connected: true, lastEvent: "open", payload: null });
  });

  source.addEventListener("connected", (event) => {
    store.setState({
      connected: true,
      lastEvent: "connected",
      payload: JSON.parse((event as MessageEvent).data) as unknown,
    });
  });

  source.addEventListener("state", (event) => {
    store.setState({
      connected: true,
      lastEvent: "state",
      payload: JSON.parse((event as MessageEvent).data) as unknown,
    });
  });

  source.addEventListener("error", () => {
    store.setState({ connected: false, lastEvent: "error", payload: null });
  });
};

connectSse();

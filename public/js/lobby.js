// src/client/lobby.ts
var button = document.getElementById("load-users");
var list = document.getElementById("user-list");
var template = document.getElementById("user-row");
button.addEventListener("click", () => {
  void fetch("/api/users").then((res) => res.json()).then((users) => {
    list.replaceChildren();
    for (const user of users) {
      const clone = template.content.cloneNode(true);
      const nameEl = clone.querySelector("[data-username]");
      const emailEl = clone.querySelector("[data-email]");
      if (nameEl) nameEl.textContent = user.username;
      if (emailEl) emailEl.textContent = user.email;
      list.appendChild(clone);
    }
  });
});
//# sourceMappingURL=lobby.js.map

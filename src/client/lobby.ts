interface User {
  username: string;
  email: string;
}

const button = document.getElementById("load-users") as HTMLButtonElement;
const list = document.getElementById("user-list") as HTMLUListElement;
const template = document.getElementById("user-row") as HTMLTemplateElement;

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

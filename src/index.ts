import express, { type Express } from "express";
import path from "path";
import session from "express-session";
import router from "./test.js";
import { attachCurrentUser } from "./middleware/auth.js";
import { setupLivereload } from "./middleware/livereload.js";

const PORT = Number(process.env.PORT) || 3005;

export function createApp(): Express {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(process.cwd(), "views"));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(process.cwd(), "public")));

  if (process.env.NODE_ENV !== "production") {
    setupLivereload(app);
  }

  app.use(
    session({
      // store: new pgSession({ conString: process.env.DATABASE_URL }),
      secret: process.env.SESSION_SECRET || "fallback-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax" },
    }),
  );

  app.use(attachCurrentUser);
  app.use(router);

  return app;
}

const app = createApp();

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

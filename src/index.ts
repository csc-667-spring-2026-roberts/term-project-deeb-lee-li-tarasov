import "dotenv/config";
import { fileURLToPath } from "url";
import express, { type Express } from "express";
import path from "path";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./test.js";
import { attachCurrentUser } from "./middleware/auth.js";
import { setupLivereload } from "./middleware/livereload.js";

const PORT = Number(process.env.PORT) || 3005;
const isProduction = process.env.NODE_ENV === "production";
const PgSession = connectPgSimple(session);

export function createApp(): Express {
  const app = express();

  const sessionSecret = process.env.SESSION_SECRET;

  if (isProduction && !sessionSecret) {
    throw new Error("SESSION_SECRET must be set in production.");
  }

  app.set("trust proxy", 1);
  app.set("view engine", "ejs");
  app.set("views", path.join(process.cwd(), "views"));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(process.cwd(), "public")));

  const sessionStore = process.env.DATABASE_URL
    ? new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      })
    : undefined;

  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret ?? "fallback-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
    }),
  );

  app.use(attachCurrentUser);
  app.use(router);

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  if (process.env.NODE_ENV === "development") {
    setupLivereload(app);
  }
  app.listen(PORT, () => {
    console.log("Server listening on port", PORT);
  });
}

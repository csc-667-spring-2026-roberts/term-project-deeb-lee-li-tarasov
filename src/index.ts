import "dotenv/config";
import express from "express";
import path from "path";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./test.js";
import { attachCurrentUser } from "./middleware/auth.js";
import { setupLivereload } from "./middleware/livereload.js";

const app = express();
const PORT = Number(process.env.PORT) || 3005;
const isProduction = process.env.NODE_ENV === "production";

const PgSession = connectPgSimple(session);
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && !sessionSecret) {
  throw new Error("SESSION_SECRET must be set in production.");
}

// Render sits behind a proxy. This lets Express trust the HTTPS/proxy headers
// so secure cookies and sessions continue to work after deployment.
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

if (!isProduction) {
  setupLivereload(app);
}

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: sessionSecret || "fallback-secret",
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

app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

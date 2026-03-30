import express from "express";
import path from "path";
import session from "express-session";
import router from "./test.js";
import { attachCurrentUser } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 3005;

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

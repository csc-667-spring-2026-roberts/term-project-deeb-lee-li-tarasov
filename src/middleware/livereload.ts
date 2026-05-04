import path from "path";
import type { Express, RequestHandler } from "express";
import * as livereloadImport from "livereload";
import connectLivereloadImport from "connect-livereload";

type LiveReloadServerLike = {
  watch: (paths: string | string[]) => void;
};

type LiveReloadModuleLike = {
  createServer: (options?: { exts?: string[]; delay?: number }) => LiveReloadServerLike;
};

type ConnectLivereloadFactory = () => RequestHandler;

const livereload = livereloadImport as unknown as LiveReloadModuleLike;
const connectLivereload = connectLivereloadImport as unknown as ConnectLivereloadFactory;

export function setupLivereload(app: Express): void {
  const lrServer = livereload.createServer({
    exts: ["ejs", "css", "js"],
    delay: 200,
  });

  lrServer.watch([path.join(process.cwd(), "views"), path.join(process.cwd(), "public")]);

  app.use(connectLivereload());
}

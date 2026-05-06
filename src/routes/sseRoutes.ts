import { Router } from "express";
import { broadcastSse, getSseClientCount, sseHandler } from "../sse.js";

interface BroadcastBody {
  event?: string;
  data?: unknown;
  room?: string;
}

const router = Router();

router.get(["/api/sse", "/api/events"], sseHandler);

router.post("/api/events/broadcast", (req, res) => {
  const { event = "message", data = {}, room } = req.body as BroadcastBody;
  const sent = broadcastSse(event, data, room);

  res.json({ ok: true, sent });
});

router.get("/api/events/status", (req, res) => {
  const room = typeof req.query.room === "string" ? req.query.room : undefined;
  res.json({ clients: getSseClientCount(room) });
});

export default router;

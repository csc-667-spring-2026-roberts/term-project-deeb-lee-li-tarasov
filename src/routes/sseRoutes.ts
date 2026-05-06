import { Router } from "express";
import { broadcastSse, getSseClientCount, sseHandler } from "../sse.js";

interface BroadcastBody {
  event?: string;
  data?: unknown;
  room?: string;
}

const router = Router();

router.get("/api/sse", sseHandler);
router.get("/api/events", sseHandler);

router.post("/api/events/broadcast", (req, res) => {
  const { event = "message", data = {}, room } = req.body as BroadcastBody;
  const sent = broadcastSse(data, { event, room });

  res.json({ ok: true, sent });
});

router.get("/api/events/status", (_req, res) => {
  res.json({ clients: getSseClientCount() });
});

export default router;

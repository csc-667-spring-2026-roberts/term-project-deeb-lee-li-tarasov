import crypto from "crypto";
import type { Request, Response } from "express";

interface SseClient {
  id: string;
  room: string;
  res: Response;
}

interface BroadcastOptions {
  event?: string;
  room?: string;
}

const clients = new Map<string, SseClient>();
const DEFAULT_ROOM = "global";
const HEARTBEAT_MS = 25000;

function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseHandler(req: Request, res: Response): void {
  const id = crypto.randomUUID();
  const room = typeof req.query.room === "string" ? req.query.room : DEFAULT_ROOM;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  clients.set(id, { id, room, res });

  res.write("retry: 3000\n");
  res.write(formatSse("connected", { id, room }));

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(id);
  });
}

export function broadcastSse(
  data: unknown,
  options: BroadcastOptions = {},
): number {
  const event = options.event ?? "message";
  const targetRoom = options.room;
  const payload = formatSse(event, data);
  let sent = 0;

  for (const client of clients.values()) {
    if (!targetRoom || client.room === targetRoom) {
      client.res.write(payload);
      sent += 1;
    }
  }

  return sent;
}

export function getSseClientCount(): number {
  return clients.size;
}

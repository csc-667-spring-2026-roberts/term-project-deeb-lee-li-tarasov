import type { Request, Response } from "express";

interface SseClient {
  id: string;
  response: Response;
  room: string;
}

const DEFAULT_ROOM = "global";
const clients = new Map<string, SseClient>();

function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function addSseClient(id: string, response: Response, room = DEFAULT_ROOM): void {
  clients.set(id, { id, response, room });
}

export function removeSseClient(id: string): void {
  clients.delete(id);
}

export function broadcastSse(event: string, data: unknown, room?: string): number {
  const payload = formatSse(event, data);
  let sent = 0;

  for (const client of clients.values()) {
    if (!room || client.room === room) {
      client.response.write(payload);
      sent += 1;
    }
  }

  return sent;
}

export function getSseClientCount(room?: string): number {
  if (!room) {
    return clients.size;
  }

  return [...clients.values()].filter((client) => client.room === room).length;
}

export function sseHandler(req: Request, res: Response): void {
  const id = crypto.randomUUID();
  const room = typeof req.query.room === "string" ? req.query.room : DEFAULT_ROOM;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  addSseClient(id, res, room);

  res.write("retry: 3000\n");
  res.write(formatSse("connected", { id, room }));

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(id);
  });
}

// Backward-compatible names in case older milestone files imported these.
export const addClient = addSseClient;
export const removeClient = removeSseClient;
export const broadcast = broadcastSse;

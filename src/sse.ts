import crypto from "crypto";
import type { Request, Response } from "express";

interface SseClient {
  id: string;
  room: string;
  res: Response;
  username: string;
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

function connectClient(req: Request, res: Response, room: string, username: string): void {
  const id = crypto.randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  clients.set(id, { id, room, res, username });

  res.write("retry: 3000\n");
  res.write(formatSse("connected", { id, room }));

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${String(Date.now())}\n\n`);
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(id);
  });
}

export function sseHandler(req: Request, res: Response): void {
  const room = typeof req.query.room === "string" ? req.query.room : DEFAULT_ROOM;
  connectClient(req, res, room, "");
}

export function lobbyConnect(req: Request, res: Response, username: string): void {
  connectClient(req, res, "lobby", username);
}

export function getOnlineUsers(room: string): string[] {
  const result: string[] = [];
  for (const client of clients.values()) {
    if (client.room === room && client.username) {
      result.push(client.username);
    }
  }
  return result;
}

export function broadcastSse(data: unknown, options: BroadcastOptions = {}): number {
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

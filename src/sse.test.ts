import assert from "node:assert/strict";
import { once } from "node:events";
import { describe, it } from "node:test";
import type { Server } from "node:http";
import { createApp } from "./index.js";

const startServer = async (): Promise<{ baseUrl: string; server: Server }> => {
  const server = createApp().listen(0);
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to start test server");
  }

  return { baseUrl: `http://127.0.0.1:${String(address.port)}`, server };
};

const closeServer = async (server: Server): Promise<void> => {
  server.closeAllConnections();
  server.close();
  await once(server, "close");
};

const readUntil = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expected: string,
): Promise<string> => {
  const decoder = new TextDecoder();
  let buffer = "";

  for (let i = 0; i < 20; i += 1) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.includes(expected)) return buffer;
  }

  return buffer;
};

void describe("Milestone 9 SSE", () => {
  void it("returns text/event-stream and keeps the connection open", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/sse?room=test-room`);
      assert.equal(response.headers.get("content-type"), "text/event-stream");
      assert.equal(response.bodyUsed, false);
      assert.ok(response.body);

      const reader = response.body.getReader();
      const firstChunk = await readUntil(reader, "event: connected");
      assert.match(firstChunk, /event: connected/);
      assert.equal(response.bodyUsed, true);
      await reader.cancel();
    } finally {
      await closeServer(server);
    }
  });

  void it("broadcasts events to clients subscribed to the same room", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/sse?room=alpha`);
      assert.ok(response.body);
      const reader = response.body.getReader();
      await readUntil(reader, "event: connected");

      const broadcast = await fetch(`${baseUrl}/api/events/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: "alpha", payload: { message: "hello" } }),
      });

      assert.equal(broadcast.status, 200);
      assert.deepEqual(await broadcast.json(), { ok: true, sent: 1 });

      const event = await readUntil(reader, "hello");
      assert.match(event, /event: state/);
      assert.match(event, /data: \{"message":"hello"\}/);
      await reader.cancel();
    } finally {
      await closeServer(server);
    }
  });

  void it("sends broadcasts to multiple subscribers", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const clientA = await fetch(`${baseUrl}/api/sse?room=multi`);
      const clientB = await fetch(`${baseUrl}/api/events?room=multi`);
      assert.ok(clientA.body);
      assert.ok(clientB.body);
      const readerA = clientA.body.getReader();
      const readerB = clientB.body.getReader();
      await readUntil(readerA, "event: connected");
      await readUntil(readerB, "event: connected");

      const broadcast = await fetch(`${baseUrl}/api/events/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: "multi", payload: { count: 2 } }),
      });

      assert.deepEqual(await broadcast.json(), { ok: true, sent: 2 });
      assert.match(await readUntil(readerA, "count"), /data: \{"count":2\}/);
      assert.match(await readUntil(readerB, "count"), /data: \{"count":2\}/);
      await readerA.cancel();
      await readerB.cancel();
    } finally {
      await closeServer(server);
    }
  });
});

import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "http";

const PING_INTERVAL_MS = 30_000;

export type BroadcastFn = (message: Record<string, unknown>) => void;

/**
 * Attaches a WebSocket server to an existing HTTP server.
 * Returns a broadcast function that sends a JSON message to all open clients.
 */
export function attachWebSocketServer(httpServer: Server): BroadcastFn {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => {
      ws.terminate();
      clients.delete(ws);
    });
  });

  // Keepalive pings so browsers don't drop idle connections
  const pingTimer = setInterval(() => {
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: "ping" }), () => undefined);
      }
    }
  }, PING_INTERVAL_MS);

  httpServer.on("close", () => clearInterval(pingTimer));

  return (message) => {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload, () => undefined);
      }
    }
  };
}

/**
 * WebSocket hub — broadcast de eventos do servidor para todos os clients.
 */
import type { WebSocket, WebSocketServer } from "ws";
import type { WsEvent } from "@/lib/types";

interface GlobalHub {
  clients: Set<WebSocket>;
}

declare global {
  // eslint-disable-next-line no-var
  var __evoteste_hub: GlobalHub | undefined;
}

function getHub(): GlobalHub {
  if (!globalThis.__evoteste_hub) {
    globalThis.__evoteste_hub = { clients: new Set() };
  }
  return globalThis.__evoteste_hub!;
}

export const hub = {
  attach(wss: WebSocketServer) {
    wss.on("connection", (ws) => {
      const h = getHub();
      h.clients.add(ws);
      try {
        ws.send(
          JSON.stringify({
            type: "hello",
            payload: { ts: new Date().toISOString() },
          } satisfies WsEvent)
        );
      } catch {
        /* noop */
      }
      ws.on("close", () => {
        h.clients.delete(ws);
      });
      ws.on("error", () => {
        h.clients.delete(ws);
      });
    });
  },
  broadcast(event: WsEvent) {
    const h = getHub();
    const data = JSON.stringify(event);
    for (const client of h.clients) {
      if (client.readyState === 1 /* OPEN */) {
        try {
          client.send(data);
        } catch {
          /* noop */
        }
      }
    }
  },
  size() {
    return getHub().clients.size;
  },
};

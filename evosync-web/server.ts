/**
 * Custom server Next.js + WebSocket + scheduler.
 * Substitui o `next dev` / `next start` padrão.
 */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { hub } from "@/server/ws/hub";
import { startSchedulerLoop, stopSchedulerLoop } from "@/server/scheduler/loop";
import { sender } from "@/server/sender/manager";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  hub.attach(wss);
  // O Next 14 + ws não compartilha o server facilmente; usamos upgrade manual.
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url || "/");
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  startSchedulerLoop();

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `\n  EvoSync web rodando em:\n  → http://localhost:${port}\n  → WebSocket: ws://localhost:${port}/ws\n`
    );
  });

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log("Encerrando EvoSync web...");
    stopSchedulerLoop();
    await sender.dispose();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar servidor:", e);
  process.exit(1);
});

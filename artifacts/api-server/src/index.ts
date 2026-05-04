import http from "node:http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { handleCallWebSocket } from "./routes/call";
import { startCronJobs } from "./services/cronService";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = request.url ?? "";
  if (url.startsWith("/api/call/ws/")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const sessionId = url.replace("/api/call/ws/", "").split("?")[0];
      handleCallWebSocket(ws, sessionId ?? "");
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startCronJobs();
});

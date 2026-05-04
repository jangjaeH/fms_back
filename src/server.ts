import { createServer } from "node:http";

import { WebSocketServer } from "ws";

import { createApp } from "./app.js";
import { store } from "./lib/store.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp();
const server = createServer(app);
const wsServer = new WebSocketServer({ server, path: "/ws" });

wsServer.on("connection", (socket) => {
  socket.send(
    JSON.stringify({
      type: "snapshot",
      payload: {
        summary: store.getDashboardSummary(),
        robots: store.getRobots(),
        alarms: store.getAlarms()
      }
    })
  );
});

const interval = setInterval(() => {
  store.tickRobotPositions();
  const message = JSON.stringify({
    type: "heartbeat",
    payload: {
      timestamp: new Date().toISOString(),
      summary: store.getDashboardSummary(),
      robots: store.getRobots()
    }
  });

  wsServer.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}, 5000);

server.listen(port, () => {
  console.log(`robot-monitoring-backend listening on http://localhost:${port}`);
});

const shutdown = () => {
  clearInterval(interval);
  wsServer.close();
  server.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

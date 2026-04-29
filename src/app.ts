import cors from "cors";
import express from "express";

import { registerRoutes } from "./routes/index.js";

export const createApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  registerRoutes(app);
  return app;
};

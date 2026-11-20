import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health.routes";
import { env } from "./lib/env";
import { AppError } from "./lib/errors";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";

export const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === env.CLIENT_URL) {
        callback(null, true);
        return;
      }

      callback(new AppError(403, "Origin not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.use("/health", healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

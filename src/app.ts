import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health.routes";
import { env } from "./lib/env";
import { AppError } from "./lib/errors";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { publicServicesRouter } from "./routes/public-services.routes";
import { vendorServicesRouter } from "./routes/vendor-services.routes";
import { adminServicesRouter } from "./routes/admin-services.routes";
import { customerBookingsRouter } from "./routes/customer-bookings.routes";
import { vendorBookingsRouter } from "./routes/vendor-bookings.routes";

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
app.use("/api/services", publicServicesRouter);
app.use("/api/vendor/services", vendorServicesRouter);
app.use("/api/admin/services", adminServicesRouter);
app.use("/api/bookings", customerBookingsRouter);
app.use("/api/vendor/bookings", vendorBookingsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

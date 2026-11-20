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
import {
  bookingCreationRouter,
  customerBookingsRouter,
} from "./routes/customer-bookings.routes";
import { vendorBookingsRouter } from "./routes/vendor-bookings.routes";
import { paymentsRouter } from "./routes/payments.routes";
import { stripeWebhookRouter } from "./routes/stripe-webhook.routes";

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
app.use("/api/webhooks/stripe", stripeWebhookRouter);
app.use(express.json());

app.use("/health", healthRouter);
app.use("/api/services", publicServicesRouter);
app.use("/api/vendor/services", vendorServicesRouter);
app.use("/api/admin/services", adminServicesRouter);
app.use("/api/bookings", bookingCreationRouter);
app.use("/api/customer/bookings", customerBookingsRouter);
app.use("/api/vendor/bookings", vendorBookingsRouter);
app.use("/api/payments", paymentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

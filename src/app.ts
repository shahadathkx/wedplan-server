import cors from "cors";
import express from "express";
import { createCorsOptions } from "./lib/cors";
import { healthRouter } from "./routes/health.routes";
import { getDatabaseConfig } from "./lib/env";
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
import { profileRouter } from "./routes/profile.routes";
import { vendorStatsRouter } from "./routes/vendor-stats.routes";
import { customerStatsRouter } from "./routes/customer-stats.routes";
import { adminRouter } from "./routes/admin.routes";
import { connectToDatabase } from "./lib/mongodb";

export const app = express();
export default app;
const nodeEnvironment =
  process.env.NODE_ENV ??
  (process.env.VERCEL === "1" ? "production" : "development");

app.use(cors(createCorsOptions(process.env.CLIENT_URL, nodeEnvironment)));
app.use("/health", healthRouter);

app.use(async (_request, _response, next) => {
  try {
    const { uri, databaseName } = getDatabaseConfig();
    await connectToDatabase(uri, databaseName);
    next();
  } catch (error) {
    next(error);
  }
});
app.use("/api/webhooks/stripe", stripeWebhookRouter);
app.use(express.json());

app.use("/api/me", profileRouter);
app.use("/api/services", publicServicesRouter);
app.use("/api/vendor/services", vendorServicesRouter);
app.use("/api/admin/services", adminServicesRouter);
app.use("/api/bookings", bookingCreationRouter);
app.use("/api/customer/bookings", customerBookingsRouter);
app.use("/api/vendor/bookings", vendorBookingsRouter);
app.use("/api/vendor/stats", vendorStatsRouter);
app.use("/api/customer/stats", customerStatsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

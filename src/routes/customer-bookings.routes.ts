import { Router } from "express";
import {
  cancelCustomerBooking,
  createCustomerBooking,
  listCustomerBookings,
} from "../controllers/customer-bookings.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const customerBookingsRouter = Router();
export const bookingCreationRouter = Router();

customerBookingsRouter.use(verifyJwt, requireRole("customer"));
customerBookingsRouter.get("/", timeRequestHandler(listCustomerBookings));
customerBookingsRouter.patch(
  "/:id/cancel",
  validateObjectId(),
  timeRequestHandler(cancelCustomerBooking),
);

bookingCreationRouter.use(verifyJwt, requireRole("customer"));
bookingCreationRouter.post("/", timeRequestHandler(createCustomerBooking));

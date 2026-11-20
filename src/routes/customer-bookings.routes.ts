import { Router } from "express";
import {
  cancelCustomerBooking,
  createCustomerBooking,
  listCustomerBookings,
} from "../controllers/customer-bookings.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";

export const customerBookingsRouter = Router();
export const bookingCreationRouter = Router();

customerBookingsRouter.use(verifyJwt, requireRole("customer"));
customerBookingsRouter.get("/", listCustomerBookings);
customerBookingsRouter.patch("/:id/cancel", validateObjectId(), cancelCustomerBooking);

bookingCreationRouter.use(verifyJwt, requireRole("customer"));
bookingCreationRouter.post("/", createCustomerBooking);

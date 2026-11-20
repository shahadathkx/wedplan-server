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

customerBookingsRouter.use(verifyJwt, requireRole("customer"));
customerBookingsRouter.get("/", listCustomerBookings);
customerBookingsRouter.post("/", createCustomerBooking);
customerBookingsRouter.patch("/:id/cancel", validateObjectId(), cancelCustomerBooking);

import { Router } from "express";
import { createCustomerBooking } from "../controllers/customer-bookings.controller";
import { requireRole } from "../middleware/require-role";
import { verifyJwt } from "../middleware/verify-jwt";

export const customerBookingsRouter = Router();

customerBookingsRouter.use(verifyJwt, requireRole("customer"));
customerBookingsRouter.post("/", createCustomerBooking);

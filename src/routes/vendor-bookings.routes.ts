import { Router } from "express";
import {
  listVendorBookings,
  updateVendorBookingStatus,
} from "../controllers/vendor-bookings.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const vendorBookingsRouter = Router();

vendorBookingsRouter.use(verifyJwt, requireRole("vendor"));
vendorBookingsRouter.get("/", timeRequestHandler(listVendorBookings));
vendorBookingsRouter.patch("/:id", validateObjectId(), timeRequestHandler(updateVendorBookingStatus));

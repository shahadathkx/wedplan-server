import { Router } from "express";
import {
  listVendorBookings,
  updateVendorBookingStatus,
} from "../controllers/vendor-bookings.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";

export const vendorBookingsRouter = Router();

vendorBookingsRouter.use(verifyJwt, requireRole("vendor"));
vendorBookingsRouter.get("/", listVendorBookings);
vendorBookingsRouter.patch("/:id", validateObjectId(), updateVendorBookingStatus);

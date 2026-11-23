import { Router } from "express";
import {
  createVendorService,
  deleteVendorService,
  listVendorServices,
  setVendorServiceAvailability,
  updateVendorService,
} from "../controllers/vendor-services.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const vendorServicesRouter = Router();

vendorServicesRouter.use(verifyJwt, requireRole("vendor"));
vendorServicesRouter.get("/", timeRequestHandler(listVendorServices));
vendorServicesRouter.post("/", timeRequestHandler(createVendorService));
vendorServicesRouter.patch(
  "/:id/availability",
  validateObjectId(),
  timeRequestHandler(setVendorServiceAvailability),
);
vendorServicesRouter.patch("/:id", validateObjectId(), timeRequestHandler(updateVendorService));
vendorServicesRouter.delete("/:id", validateObjectId(), timeRequestHandler(deleteVendorService));

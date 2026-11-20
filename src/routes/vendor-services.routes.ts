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

export const vendorServicesRouter = Router();

vendorServicesRouter.use(verifyJwt, requireRole("vendor"));
vendorServicesRouter.get("/", listVendorServices);
vendorServicesRouter.post("/", createVendorService);
vendorServicesRouter.patch("/:id/availability", validateObjectId(), setVendorServiceAvailability);
vendorServicesRouter.patch("/:id", validateObjectId(), updateVendorService);
vendorServicesRouter.delete("/:id", validateObjectId(), deleteVendorService);

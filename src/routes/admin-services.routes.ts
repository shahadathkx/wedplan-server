import { Router } from "express";
import {
  deleteAdminService,
  listAdminServices,
  setAdminServiceStatus,
} from "../controllers/admin-services.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";

export const adminServicesRouter = Router();

adminServicesRouter.use(verifyJwt, requireRole("admin"));
adminServicesRouter.get("/", listAdminServices);
adminServicesRouter.patch("/:id/status", validateObjectId(), setAdminServiceStatus);
adminServicesRouter.delete("/:id", validateObjectId(), deleteAdminService);

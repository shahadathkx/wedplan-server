import { Router } from "express";
import {
  deleteAdminService,
  listAdminServices,
  setAdminServiceStatus,
} from "../controllers/admin-services.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const adminServicesRouter = Router();

adminServicesRouter.use(verifyJwt, requireRole("admin"));
adminServicesRouter.get("/", timeRequestHandler(listAdminServices));
adminServicesRouter.patch(
  "/:id/status",
  validateObjectId(),
  timeRequestHandler(setAdminServiceStatus),
);
adminServicesRouter.delete("/:id", validateObjectId(), timeRequestHandler(deleteAdminService));

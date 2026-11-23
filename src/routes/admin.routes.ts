import { Router } from "express";
import {
  getAdminStats,
  getAdminUser,
  listAdminTransactions,
  listAdminUsers,
  setAdminUserBlocked,
} from "../controllers/admin.controller";
import { requireRole } from "../middleware/require-role";
import { validateObjectId } from "../middleware/validate-object-id";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const adminRouter = Router();

adminRouter.use(verifyJwt, requireRole("admin"));
adminRouter.get("/stats", timeRequestHandler(getAdminStats));
adminRouter.get("/users", timeRequestHandler(listAdminUsers));
adminRouter.get("/users/:id", validateObjectId(), timeRequestHandler(getAdminUser));
adminRouter.patch("/users/:id/block", validateObjectId(), timeRequestHandler(setAdminUserBlocked));
adminRouter.get("/transactions", timeRequestHandler(listAdminTransactions));

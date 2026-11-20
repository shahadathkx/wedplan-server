import { Router } from "express";
import {
  getAdminStats,
  getAdminUser,
  listAdminTransactions,
  listAdminUsers,
  setAdminUserBlocked,
} from "../controllers/admin.controller";
import { requireRole } from "../middleware/require-role";
import { verifyJwt } from "../middleware/verify-jwt";

export const adminRouter = Router();

adminRouter.use(verifyJwt, requireRole("admin"));
adminRouter.get("/stats", getAdminStats);
adminRouter.get("/users", listAdminUsers);
adminRouter.get("/users/:id", getAdminUser);
adminRouter.patch("/users/:id/block", setAdminUserBlocked);
adminRouter.get("/transactions", listAdminTransactions);

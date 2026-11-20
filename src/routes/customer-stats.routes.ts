import { Router } from "express";
import { getCustomerStats } from "../controllers/stats.controller";
import { requireRole } from "../middleware/require-role";
import { verifyJwt } from "../middleware/verify-jwt";

export const customerStatsRouter = Router();

customerStatsRouter.use(verifyJwt, requireRole("customer"));
customerStatsRouter.get("/", getCustomerStats);

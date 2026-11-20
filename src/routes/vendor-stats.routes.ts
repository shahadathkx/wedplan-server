import { Router } from "express";
import { getVendorStats } from "../controllers/stats.controller";
import { requireRole } from "../middleware/require-role";
import { verifyJwt } from "../middleware/verify-jwt";

export const vendorStatsRouter = Router();

vendorStatsRouter.use(verifyJwt, requireRole("vendor"));
vendorStatsRouter.get("/", getVendorStats);

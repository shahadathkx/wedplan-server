import { Router } from "express";
import { getVendorStats } from "../controllers/stats.controller";
import { requireRole } from "../middleware/require-role";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const vendorStatsRouter = Router();

vendorStatsRouter.use(verifyJwt, requireRole("vendor"));
vendorStatsRouter.get("/", timeRequestHandler(getVendorStats));

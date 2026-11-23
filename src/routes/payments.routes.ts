import { Router } from "express";
import { createCheckoutSession } from "../controllers/payments.controller";
import { requireRole } from "../middleware/require-role";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const paymentsRouter = Router();

paymentsRouter.use(verifyJwt, requireRole("vendor"));
paymentsRouter.post("/checkout", timeRequestHandler(createCheckoutSession));

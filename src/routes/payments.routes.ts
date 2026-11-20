import { Router } from "express";
import { createCheckoutSession } from "../controllers/payments.controller";
import { requireRole } from "../middleware/require-role";
import { verifyJwt } from "../middleware/verify-jwt";

export const paymentsRouter = Router();

paymentsRouter.use(verifyJwt, requireRole("vendor"));
paymentsRouter.post("/checkout", createCheckoutSession);

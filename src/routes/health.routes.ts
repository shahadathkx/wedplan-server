import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import { timeRequestHandler } from "../middleware/request-timing";

export const healthRouter = Router();

healthRouter.get("/", timeRequestHandler(getHealth));

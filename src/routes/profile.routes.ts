import { Router } from "express";
import {
  getCurrentProfile,
  updateCurrentProfile,
} from "../controllers/profile.controller";
import { verifyJwt } from "../middleware/verify-jwt";
import { timeRequestHandler } from "../middleware/request-timing";

export const profileRouter = Router();

profileRouter.use(verifyJwt);
profileRouter.get("/", timeRequestHandler(getCurrentProfile));
profileRouter.patch("/", timeRequestHandler(updateCurrentProfile));

import { Router } from "express";
import {
  getCurrentProfile,
  updateCurrentProfile,
} from "../controllers/profile.controller";
import { verifyJwt } from "../middleware/verify-jwt";

export const profileRouter = Router();

profileRouter.use(verifyJwt);
profileRouter.get("/", getCurrentProfile);
profileRouter.patch("/", updateCurrentProfile);

import { Router } from "express";
import {
  getFeaturedServices,
  getPublicServiceById,
  listPublicServices,
} from "../controllers/public-services.controller";
import { validateObjectId } from "../middleware/validate-object-id";
import { timeRequestHandler } from "../middleware/request-timing";

export const publicServicesRouter = Router();

publicServicesRouter.get("/", timeRequestHandler(listPublicServices));
publicServicesRouter.get("/featured", timeRequestHandler(getFeaturedServices));
publicServicesRouter.get("/:id", validateObjectId(), timeRequestHandler(getPublicServiceById));

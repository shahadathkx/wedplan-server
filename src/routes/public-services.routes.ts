import { Router } from "express";
import {
  getFeaturedServices,
  getPublicServiceById,
  listPublicServices,
} from "../controllers/public-services.controller";
import { validateObjectId } from "../middleware/validate-object-id";

export const publicServicesRouter = Router();

publicServicesRouter.get("/", listPublicServices);
publicServicesRouter.get("/featured", getFeaturedServices);
publicServicesRouter.get("/:id", validateObjectId(), getPublicServiceById);

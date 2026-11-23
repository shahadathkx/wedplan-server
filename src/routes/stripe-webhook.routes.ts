import express, { Router } from "express";
import { receiveStripeWebhook } from "../controllers/stripe-webhook.controller";
import { timeRequestHandler } from "../middleware/request-timing";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post(
  "/",
  express.raw({ type: "application/json" }),
  timeRequestHandler(receiveStripeWebhook),
);

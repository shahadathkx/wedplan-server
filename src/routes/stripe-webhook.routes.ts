import express, { Router } from "express";
import { receiveStripeWebhook } from "../controllers/stripe-webhook.controller";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/", express.raw({ type: "application/json" }), receiveStripeWebhook);

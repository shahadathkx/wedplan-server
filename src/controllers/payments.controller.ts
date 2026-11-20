import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { env } from "../lib/env";
import { getUserId } from "../lib/users";
import { stripe } from "../lib/stripe";
import { parseInput } from "../lib/validation";

const checkoutRequestSchema = z
  .object({
    vendorId: z.unknown().optional(),
  })
  .strict()
  .optional();

export const createCheckoutSession: RequestHandler = async (request, response) => {
  parseInput(checkoutRequestSchema, request.body);
  const vendorId = getUserId(request.user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/subscription/cancelled`,
    client_reference_id: vendorId,
    metadata: { vendorId },
    subscription_data: { metadata: { vendorId } },
  });

  if (!session.url) {
    throw new AppError(502, "Stripe did not return a checkout URL");
  }

  response.status(200).json({ url: session.url, sessionId: session.id });
};

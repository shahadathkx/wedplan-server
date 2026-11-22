import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { getClientUrl, getStripePriceId } from "../lib/env";
import { getUserId } from "../lib/users";
import { getStripe } from "../lib/stripe";
import { getCheckoutReturnUrls } from "../lib/payment-urls";
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
  const clientUrl = getClientUrl();
  const { successUrl, cancelUrl } = getCheckoutReturnUrls(clientUrl);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: vendorId,
    metadata: { vendorId },
    subscription_data: { metadata: { vendorId } },
  });

  if (!session.url) {
    throw new AppError(502, "Stripe did not return a checkout URL");
  }

  response.status(200).json({ url: session.url, sessionId: session.id });
};

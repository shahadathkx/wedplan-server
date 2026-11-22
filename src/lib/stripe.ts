import Stripe from "stripe";
import { getStripeSecretKey } from "./env";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  stripeClient ??= new Stripe(getStripeSecretKey());
  return stripeClient;
}

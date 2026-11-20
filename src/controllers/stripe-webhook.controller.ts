import type { RequestHandler } from "express";
import { MongoServerError, ObjectId } from "mongodb";
import Stripe from "stripe";
import { AppError } from "../lib/errors";
import { env } from "../lib/env";
import { getDatabase } from "../lib/mongodb";
import { stripe } from "../lib/stripe";
import { userIdFilter, type UserRecord } from "../lib/users";

function getSubscriptionExpiry(subscription: Stripe.Subscription): Date | null {
  const periodEnds = subscription.items.data.map((item) => item.current_period_end);
  if (periodEnds.length === 0) {
    return null;
  }

  const latestPeriodEnd = Math.max(...periodEnds);
  return Number.isFinite(latestPeriodEnd) ? new Date(latestPeriodEnd * 1000) : null;
}

async function setVendorSubscription(
  vendorId: string,
  subscriptionPlan: "free" | "premium",
  subscriptionExpiresAt: Date | null,
): Promise<void> {
  const result = await getDatabase()
    .collection<UserRecord>("user")
    .updateOne(
      { ...userIdFilter(vendorId), role: "vendor" },
      { $set: { subscriptionPlan, subscriptionExpiresAt } },
    );

  if (result.matchedCount === 0) {
    throw new AppError(404, "Stripe subscription vendor not found");
  }
}

async function syncSubscription(
  vendorId: string,
  subscription: Stripe.Subscription,
  forceFree = false,
): Promise<void> {
  const expiresAt = getSubscriptionExpiry(subscription);
  const eligibleStatuses: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];
  const isPremium =
    !forceFree &&
    eligibleStatuses.includes(subscription.status) &&
    expiresAt !== null &&
    expiresAt.getTime() > Date.now();

  await setVendorSubscription(
    vendorId,
    isPremium ? "premium" : "free",
    isPremium ? expiresAt : null,
  );
}

function requiredVendorId(metadata: Stripe.Metadata | null | undefined): string {
  const vendorId = metadata?.vendorId;
  if (!vendorId || vendorId.trim().length === 0) {
    throw new AppError(400, "Stripe event is missing vendor metadata");
  }
  return vendorId;
}

async function recordCheckoutTransaction(
  session: Stripe.Checkout.Session,
  vendorId: string,
  subscriptionId: string,
): Promise<void> {
  try {
    await getDatabase().collection("transactions").insertOne({
      _id: new ObjectId(),
      vendorId,
      plan: "premium",
      amount: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      stripeSessionId: session.id,
      stripeSubscriptionId: subscriptionId,
      status: session.payment_status,
      createdAt: new Date(),
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return;
    }
    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const vendorId = requiredVendorId(session.metadata);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    throw new AppError(400, "Completed checkout session has no subscription");
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(vendorId, subscription);
  await recordCheckoutTransaction(session, vendorId, subscriptionId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionReference = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionReference) {
    return;
  }

  const subscription =
    typeof subscriptionReference === "string"
      ? await stripe.subscriptions.retrieve(subscriptionReference)
      : await stripe.subscriptions.retrieve(subscriptionReference.id);
  const vendorId =
    subscription.metadata.vendorId ??
    invoice.parent?.subscription_details?.metadata?.vendorId;
  await syncSubscription(requiredVendorId({ vendorId }), subscription);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const currentSubscription = await stripe.subscriptions.retrieve(subscription.id);
  await syncSubscription(
    requiredVendorId(currentSubscription.metadata),
    currentSubscription,
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  await setVendorSubscription(requiredVendorId(subscription.metadata), "free", null);
}

export const receiveStripeWebhook: RequestHandler = async (request, response) => {
  const signature = request.header("stripe-signature");
  if (!signature || !Buffer.isBuffer(request.body)) {
    throw new AppError(400, "Missing or invalid Stripe webhook signature");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError(400, "Invalid Stripe webhook signature");
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object);
      break;
  }

  response.status(200).json({ received: true });
};

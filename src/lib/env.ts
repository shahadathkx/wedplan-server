import "dotenv/config";
import { z } from "zod";
import { AppError } from "./errors";

function requiredString(name: string, source: NodeJS.ProcessEnv): string {
  const parsed = z.string().trim().min(1).safeParse(source[name]);
  if (!parsed.success) {
    throw new AppError(500, `Server configuration error: ${name} is missing or invalid`);
  }

  return parsed.data;
}

function requiredUrl(name: string, source: NodeJS.ProcessEnv): string {
  const value = requiredString(name, source);
  const parsed = z.string().url().safeParse(value);
  if (!parsed.success) {
    throw new AppError(500, `Server configuration error: ${name} is missing or invalid`);
  }

  return parsed.data;
}

export function getDatabaseConfig(source: NodeJS.ProcessEnv = process.env): {
  uri: string;
  databaseName: string;
} {
  return {
    uri: requiredString("MONGODB_URI", source),
    databaseName: requiredString("DB_NAME", source),
  };
}

export function getClientUrl(source: NodeJS.ProcessEnv = process.env): string {
  return new URL(requiredUrl("CLIENT_URL", source)).origin;
}

export function getJwksUrl(source: NodeJS.ProcessEnv = process.env): string {
  return requiredUrl("JWKS_URL", source);
}

export function getStripeSecretKey(source: NodeJS.ProcessEnv = process.env): string {
  return requiredString("STRIPE_SECRET_KEY", source);
}

export function getStripeWebhookSecret(source: NodeJS.ProcessEnv = process.env): string {
  return requiredString("STRIPE_WEBHOOK_SECRET", source);
}

export function getStripePriceId(source: NodeJS.ProcessEnv = process.env): string {
  return requiredString("STRIPE_PRICE_ID", source);
}

export function getPort(source: NodeJS.ProcessEnv = process.env): number {
  const parsed = z.coerce.number().int().min(1).max(65535).safeParse(source.PORT ?? 5000);
  if (!parsed.success) {
    throw new AppError(500, "Server configuration error: PORT is invalid");
  }

  return parsed.data;
}

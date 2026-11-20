import { ObjectId, type Filter } from "mongodb";
import { AppError } from "./errors";

export const userRoles = ["customer", "vendor", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export interface UserRecord {
  _id?: ObjectId | string;
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  isBlocked?: boolean;
  businessName?: string | null;
  subscriptionPlan?: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
}

export function userIdFilter(id: string): Filter<UserRecord> {
  const alternatives: Filter<UserRecord>[] = [{ id }, { _id: id }];
  if (/^[a-f\d]{24}$/i.test(id)) {
    alternatives.push({ _id: new ObjectId(id) });
  }
  return { $or: alternatives };
}

export function getUserId(user: UserRecord | undefined): string {
  const id = user?.id ?? user?._id?.toString();
  if (!id) {
    throw new AppError(401, "Authenticated user has no identifier");
  }
  return id;
}

export function hasPremiumSubscription(user: UserRecord | undefined): boolean {
  if (!user || user.subscriptionPlan !== "premium") {
    return false;
  }
  if (!user.subscriptionExpiresAt) {
    return true;
  }

  const expiresAt = new Date(user.subscriptionExpiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
}

export function hasExpiredPremiumSubscription(user: UserRecord | undefined): boolean {
  if (!user || user.subscriptionPlan !== "premium" || !user.subscriptionExpiresAt) {
    return false;
  }

  const expiresAt = new Date(user.subscriptionExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
}

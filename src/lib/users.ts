import { ObjectId, type Filter } from "mongodb";
import { AppError } from "./errors";
import { getDatabase, getMongoClientDiagnostics } from "./mongodb";

export const userRoles = ["customer", "vendor", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export interface UserRecord {
  _id?: ObjectId | string;
  id?: string;
  name?: string;
  email?: string;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  role?: UserRole;
  isBlocked?: boolean;
  businessName?: string | null;
  subscriptionPlan?: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
}

export interface TokenClaims {
  sub?: unknown;
  email?: unknown;
}

export type UserLookupMethod = "sub_object_id" | "sub_string" | "id" | "email";

export interface TokenUserResolution {
  user: UserRecord | null;
  matchedBy: UserLookupMethod | null;
}

export async function getUserFromToken(claims: TokenClaims): Promise<TokenUserResolution> {
  const users = getDatabase().collection<UserRecord>("user");
  const sub = typeof claims.sub === "string" && claims.sub.length > 0
    ? claims.sub
    : undefined;
  const lookupsRun = {
    objectIdSub: false,
    stringSub: false,
    idField: false,
    caseInsensitiveEmail: false,
  };

  if (sub && /^[a-f\d]{24}$/i.test(sub)) {
    lookupsRun.objectIdSub = true;
    const user = await users.findOne({ _id: new ObjectId(sub) });
    if (user) {
      return { user, matchedBy: "sub_object_id" };
    }
  }

  if (sub) {
    lookupsRun.stringSub = true;
    const user = await users.findOne({ _id: sub });
    if (user) {
      return { user, matchedBy: "sub_string" };
    }

    lookupsRun.idField = true;
    const userById = await users.findOne({ id: sub });
    if (userById) {
      return { user: userById, matchedBy: "id" };
    }
  }

  if (typeof claims.email === "string" && claims.email.length > 0) {
    lookupsRun.caseInsensitiveEmail = true;
    const user = await users.findOne(
      { email: claims.email },
      { collation: { locale: "en", strength: 2 } },
    );
    if (user) {
      return { user, matchedBy: "email" };
    }
  }

  try {
    const diagnostics = await getMongoClientDiagnostics();
    console.error("JWT user lookup missed", {
      claims: {
        subPresent: sub !== undefined,
        emailPresent: typeof claims.email === "string" && claims.email.length > 0,
      },
      lookupsRun,
      configuredDatabaseName: process.env.DB_NAME ?? null,
      clientDatabaseName: diagnostics.databaseName,
      selectedDatabaseName: diagnostics.selectedDatabaseName,
      collectionNames: diagnostics.collectionNames,
    });
  } catch (error) {
    console.error("JWT user lookup missed; MongoDB diagnostics could not be collected", {
      claims: {
        subPresent: sub !== undefined,
        emailPresent: typeof claims.email === "string" && claims.email.length > 0,
      },
      lookupsRun,
      configuredDatabaseName: process.env.DB_NAME ?? null,
      diagnosticsError:
        error instanceof Error ? error.name : "Unknown diagnostics error",
    });
  }

  return { user: null, matchedBy: null };
}

export function userIdFilter(id: string | ObjectId): Filter<UserRecord> {
  const stringId = id.toString();
  const alternatives: Filter<UserRecord>[] = [{ id: stringId }, { _id: stringId }];
  if (/^[a-f\d]{24}$/i.test(stringId)) {
    alternatives.push({ _id: new ObjectId(stringId) });
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

export function getUserObjectId(user: UserRecord | undefined): ObjectId {
  if (user?._id instanceof ObjectId) {
    return user._id;
  }

  const id = typeof user?._id === "string" ? user._id : user?.id;
  if (typeof id === "string" && /^[a-f\d]{24}$/i.test(id)) {
    return new ObjectId(id);
  }

  throw new AppError(500, "User record does not have a MongoDB ObjectId");
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

import { ObjectId, type Filter } from "mongodb";
import { AppError } from "./errors";
import {
  getDatabase,
  getMongoClientDiagnostics,
  getMongoUserEstimatedCount,
} from "./mongodb";

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
  id?: unknown;
  iss?: unknown;
  aud?: unknown;
}

export type UserLookupMethod = "sub_object_id" | "sub_string" | "id" | "email";

type LookupAttempt = {
  ran: boolean;
  matched: boolean;
};

export interface AuthLookupDebug {
  claimsPresent: {
    sub: boolean;
    email: boolean;
    id: boolean;
  };
  databaseName: string | null;
  envDbName: string | null;
  collections: string[];
  userCount: number | null;
  tried: {
    objectIdSub: LookupAttempt;
    stringSub: LookupAttempt;
    idField: LookupAttempt;
    caseInsensitiveEmail: LookupAttempt;
  };
  tokenIssuer?: string;
  tokenAudience?: string | string[];
}

export interface TokenUserResolution {
  user: UserRecord | null;
  matchedBy: UserLookupMethod | null;
  debug?: AuthLookupDebug;
}

export async function getUserFromToken(claims: TokenClaims): Promise<TokenUserResolution> {
  const users = getDatabase().collection<UserRecord>("user");
  const sub = typeof claims.sub === "string" && claims.sub.length > 0
    ? claims.sub
    : undefined;
  const tried = {
    objectIdSub: { ran: false, matched: false },
    stringSub: { ran: false, matched: false },
    idField: { ran: false, matched: false },
    caseInsensitiveEmail: { ran: false, matched: false },
  };

  if (sub && /^[a-f\d]{24}$/i.test(sub)) {
    tried.objectIdSub.ran = true;
    const user = await users.findOne({ _id: new ObjectId(sub) });
    if (user) {
      tried.objectIdSub.matched = true;
      return { user, matchedBy: "sub_object_id" };
    }
  }

  if (sub) {
    tried.stringSub.ran = true;
    const user = await users.findOne({ _id: sub });
    if (user) {
      tried.stringSub.matched = true;
      return { user, matchedBy: "sub_string" };
    }

    tried.idField.ran = true;
    const userById = await users.findOne({ id: sub });
    if (userById) {
      tried.idField.matched = true;
      return { user: userById, matchedBy: "id" };
    }
  }

  if (typeof claims.email === "string" && claims.email.length > 0) {
    tried.caseInsensitiveEmail.ran = true;
    const user = await users.findOne(
      { email: claims.email },
      { collation: { locale: "en", strength: 2 } },
    );
    if (user) {
      tried.caseInsensitiveEmail.matched = true;
      return { user, matchedBy: "email" };
    }
  }

  const debug = process.env.DEBUG_AUTH === "1"
    ? await createAuthLookupDebug(claims, tried)
    : undefined;

  try {
    const diagnostics = await getMongoClientDiagnostics();
    console.error("JWT user lookup missed", {
      claims: {
        subPresent: sub !== undefined,
        emailPresent: typeof claims.email === "string" && claims.email.length > 0,
      },
      lookupsRun: {
        objectIdSub: tried.objectIdSub.ran,
        stringSub: tried.stringSub.ran,
        idField: tried.idField.ran,
        caseInsensitiveEmail: tried.caseInsensitiveEmail.ran,
      },
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
      lookupsRun: {
        objectIdSub: tried.objectIdSub.ran,
        stringSub: tried.stringSub.ran,
        idField: tried.idField.ran,
        caseInsensitiveEmail: tried.caseInsensitiveEmail.ran,
      },
      configuredDatabaseName: process.env.DB_NAME ?? null,
      diagnosticsError:
        error instanceof Error ? error.name : "Unknown diagnostics error",
    });
  }

  return {
    user: null,
    matchedBy: null,
    ...(debug ? { debug } : {}),
  };
}

async function createAuthLookupDebug(
  claims: TokenClaims,
  tried: AuthLookupDebug["tried"],
): Promise<AuthLookupDebug> {
  let databaseName: string | null = null;
  let collections: string[] = [];
  let userCount: number | null = null;

  try {
    const [diagnostics, estimatedUserCount] = await Promise.all([
      getMongoClientDiagnostics(),
      getMongoUserEstimatedCount(),
    ]);
    databaseName = diagnostics.databaseName;
    collections = diagnostics.collectionNames;
    userCount = estimatedUserCount;
  } catch {
    // Keep diagnostics best-effort so a lookup miss remains a 401.
  }

  const issuer = typeof claims.iss === "string" ? claims.iss : undefined;
  const audience = typeof claims.aud === "string"
    ? claims.aud
    : Array.isArray(claims.aud) &&
        claims.aud.every((value): value is string => typeof value === "string")
      ? claims.aud
      : undefined;

  return {
    claimsPresent: {
      sub: typeof claims.sub === "string" && claims.sub.length > 0,
      email: typeof claims.email === "string" && claims.email.length > 0,
      id: typeof claims.id === "string" && claims.id.length > 0,
    },
    databaseName,
    envDbName: process.env.DB_NAME ?? null,
    collections,
    userCount,
    tried,
    ...(issuer ? { tokenIssuer: issuer } : {}),
    ...(audience !== undefined ? { tokenAudience: audience } : {}),
  };
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

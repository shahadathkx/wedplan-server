import type { RequestHandler } from "express";
import type { createRemoteJWKSet } from "jose";
import { getJwksUrl } from "../lib/env";
import { AppError } from "../lib/errors";
import { getDatabase } from "../lib/mongodb";
import { expireVendorPremiumIfDue } from "../lib/service-capacity";
import {
  hasExpiredPremiumSubscription,
  userIdFilter,
  type UserRecord,
} from "../lib/users";

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let joseModule: Promise<typeof import("jose")> | undefined;

function loadJose(): Promise<typeof import("jose")> {
  joseModule ??= import("jose");
  return joseModule;
}

export const verifyJwt: RequestHandler = async (request, _response, next) => {
  const authorization = request.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new AppError(401, "Missing or invalid authorization token"));
    return;
  }

  const jose = await loadJose();
  try {
    remoteJwks ??= jose.createRemoteJWKSet(new URL(getJwksUrl()));
    const { payload } = await jose.jwtVerify(match[1], remoteJwks);
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      next(new AppError(401, "Invalid authorization token"));
      return;
    }

    const users = getDatabase().collection<UserRecord>("user");
    let user = await users.findOne(userIdFilter(payload.sub));

    if (!user) {
      next(new AppError(401, "User associated with token was not found"));
      return;
    }
    if (user.isBlocked) {
      next(new AppError(403, "User is blocked"));
      return;
    }

    if (user.role === "vendor" && hasExpiredPremiumSubscription(user)) {
      await expireVendorPremiumIfDue(payload.sub);
      const refreshedUser = await users.findOne(userIdFilter(payload.sub));
      if (!refreshedUser) {
        next(new AppError(401, "User associated with token was not found"));
        return;
      }
      if (refreshedUser.isBlocked) {
        next(new AppError(403, "User is blocked"));
        return;
      }
      user = refreshedUser;
    }

    request.user = user;
    next();
  } catch (error) {
    if (error instanceof jose.errors.JOSEError) {
      next(new AppError(401, "Invalid or expired authorization token"));
      return;
    }
    next(error);
  }
};

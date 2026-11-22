import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type { RequestHandler } from "express";
import { getJwksUrl } from "../lib/env";
import { AppError } from "../lib/errors";
import { getDatabase } from "../lib/mongodb";
import {
  hasExpiredPremiumSubscription,
  userIdFilter,
  type UserRecord,
} from "../lib/users";

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getRemoteJwks(): ReturnType<typeof createRemoteJWKSet> {
  remoteJwks ??= createRemoteJWKSet(new URL(getJwksUrl()));
  return remoteJwks;
}

export const verifyJwt: RequestHandler = async (request, _response, next) => {
  const authorization = request.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new AppError(401, "Missing or invalid authorization token"));
    return;
  }

  try {
    const { payload } = await jwtVerify(match[1], getRemoteJwks());
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
      const result = await users.updateOne(
        {
          ...userIdFilter(payload.sub),
          role: "vendor",
          subscriptionPlan: "premium",
          subscriptionExpiresAt: user.subscriptionExpiresAt,
        },
        { $set: { subscriptionPlan: "free", subscriptionExpiresAt: null } },
      );

      if (result.matchedCount > 0) {
        user.subscriptionPlan = "free";
        user.subscriptionExpiresAt = null;
      } else {
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
    }

    request.user = user;
    next();
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      next(new AppError(401, "Invalid or expired authorization token"));
      return;
    }
    next(error);
  }
};

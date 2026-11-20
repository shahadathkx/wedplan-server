import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type { RequestHandler } from "express";
import { env } from "../lib/env";
import { AppError } from "../lib/errors";
import { getDatabase } from "../lib/mongodb";
import type { UserRecord } from "../lib/users";

const remoteJwks = createRemoteJWKSet(new URL(env.JWKS_URL));

export const verifyJwt: RequestHandler = async (request, _response, next) => {
  const authorization = request.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next(new AppError(401, "Missing or invalid authorization token"));
    return;
  }

  try {
    const { payload } = await jwtVerify(match[1], remoteJwks);
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      next(new AppError(401, "Invalid authorization token"));
      return;
    }

    const user = await getDatabase()
      .collection<UserRecord>("user")
      .findOne({ $or: [{ _id: payload.sub }, { id: payload.sub }] });

    if (!user) {
      next(new AppError(401, "User associated with token was not found"));
      return;
    }
    if (user.isBlocked) {
      next(new AppError(403, "User is blocked"));
      return;
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

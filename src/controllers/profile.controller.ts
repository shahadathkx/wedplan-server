import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";
import { getDatabase } from "../lib/mongodb";
import { updateProfileSchema } from "../lib/profiles";
import { getUserId, userIdFilter, type UserRecord } from "../lib/users";
import { parseInput } from "../lib/validation";

function profileResponse(user: UserRecord) {
  return {
    id: getUserId(user),
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    role: user.role ?? null,
    isBlocked: user.isBlocked ?? false,
    businessName: user.businessName ?? null,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
  };
}

export const getCurrentProfile: RequestHandler = async (request, response) => {
  if (!request.user) {
    throw new AppError(401, "Authentication is required");
  }

  response.status(200).json({ user: profileResponse(request.user) });
};

export const updateCurrentProfile: RequestHandler = async (request, response) => {
  const input = parseInput(updateProfileSchema, request.body);
  const userId = getUserId(request.user);
  const users = getDatabase().collection<UserRecord>("user");
  const result = await users.updateOne(
    userIdFilter(userId),
    { $set: { ...input, updatedAt: new Date() } },
  );

  if (result.matchedCount === 0) {
    throw new AppError(404, "User not found");
  }

  const user = await users.findOne(userIdFilter(userId));
  if (!user) {
    throw new AppError(404, "User not found");
  }

  response.status(200).json({ user: profileResponse(user) });
};

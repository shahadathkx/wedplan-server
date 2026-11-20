import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";
import type { UserRole } from "../lib/users";

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "Authentication is required"));
      return;
    }

    if (!request.user.role || !roles.includes(request.user.role)) {
      next(new AppError(403, "You do not have permission to access this resource"));
      return;
    }

    next();
  };
}

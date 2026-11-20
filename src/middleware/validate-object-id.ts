import { ObjectId } from "mongodb";
import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";

export function validateObjectId(parameterName = "id"): RequestHandler {
  return (request, _response, next) => {
    const value = request.params[parameterName];
    if (typeof value !== "string" || !ObjectId.isValid(value)) {
      next(new AppError(400, `Invalid ${parameterName}`));
      return;
    }

    next();
  };
}

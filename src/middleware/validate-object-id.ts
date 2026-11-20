import type { RequestHandler } from "express";
import { parseObjectId } from "../lib/object-id";

export function validateObjectId(parameterName = "id"): RequestHandler {
  return (request, _response, next) => {
    try {
      parseObjectId(request.params[parameterName], parameterName);
      next();
    } catch (error) {
      next(error);
      return;
    }
  };
}

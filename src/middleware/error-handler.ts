import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors";

function isMalformedJsonBody(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (isMalformedJsonBody(error)) {
    response.status(400).json({ message: "Invalid JSON body" });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      message: error.message,
      ...(error.debug ? { debug: error.debug } : {}),
    });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Internal server error" });
};

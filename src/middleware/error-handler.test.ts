import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { AppError } from "../lib/errors";
import { errorHandler } from "./error-handler";

test("error handler returns optional auth diagnostics as JSON", async () => {
  const app = express();
  app.get("/diagnostic", (_request, _response, next) => {
    next(new AppError(401, "User associated with token was not found", {
      claimsPresent: { sub: true },
    }));
  });
  app.get("/regular", (_request, _response, next) => {
    next(new AppError(401, "Unauthorized"));
  });
  app.use(errorHandler);

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const diagnosticResponse = await fetch(`${baseUrl}/diagnostic`);
    assert.equal(diagnosticResponse.status, 401);
    assert.deepEqual(await diagnosticResponse.json(), {
      message: "User associated with token was not found",
      debug: { claimsPresent: { sub: true } },
    });

    const regularResponse = await fetch(`${baseUrl}/regular`);
    assert.equal(regularResponse.status, 401);
    assert.deepEqual(await regularResponse.json(), { message: "Unauthorized" });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import cors from "cors";
import express from "express";
import { createCorsOptions, isAllowedCorsOrigin } from "./cors";
import { errorHandler } from "../middleware/error-handler";

const productionClient = "https://wedplan-client-eight.vercel.app";

test("CORS allows only the configured client, plus localhost during development", () => {
  assert.equal(isAllowedCorsOrigin(productionClient, productionClient, "production"), true);
  assert.equal(isAllowedCorsOrigin(productionClient, `${productionClient}/`, "production"), true);
  assert.equal(
    isAllowedCorsOrigin(`${productionClient}/`, productionClient, "production"),
    false,
  );
  assert.equal(isAllowedCorsOrigin("http://localhost:3000", productionClient, "development"), true);
  assert.equal(isAllowedCorsOrigin("http://localhost:3000", productionClient, "production"), false);
  assert.equal(isAllowedCorsOrigin("https://other.example", productionClient, "development"), false);
  assert.equal(isAllowedCorsOrigin(undefined, productionClient, "development"), false);
});

test("CORS preflight allows Authorization and Content-Type for PATCH", async () => {
  const app = express();
  app.use(cors(createCorsOptions(productionClient, "production")));
  app.use(errorHandler);
  app.patch("/", (_request, response) => response.status(204).end());
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/`, {
      method: "OPTIONS",
      headers: {
        Origin: productionClient,
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), productionClient);
    assert.match(
      response.headers.get("access-control-allow-headers") ?? "",
      /Authorization/i,
    );
    assert.equal(
      response.headers.get("access-control-allow-methods"),
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { errorHandler } from "./error-handler";
import {
  recordDatabaseCommandFinished,
  recordDatabaseCommandStarted,
  requestTimingMiddleware,
  timeRequestHandler,
} from "./request-timing";

test("request timing reports middleware, database, handler, and slowest endpoint", async () => {
  const originalInfo = console.info;
  const logs: Array<{ label: string; details: Record<string, unknown> }> = [];
  console.info = (label?: unknown, details?: unknown) => {
    if (typeof label === "string" && typeof details === "object" && details !== null) {
      logs.push({ label, details: details as Record<string, unknown> });
    }
  };

  const app = express();
  app.use(requestTimingMiddleware);
  app.get(
    "/timed",
    timeRequestHandler(async (_request, response) => {
      recordDatabaseCommandStarted({ requestId: 1, connectionId: "test-connection" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      recordDatabaseCommandFinished({ requestId: 1, connectionId: "test-connection" });
      response.status(200).json({ ok: true });
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/timed`);
    assert.equal(response.status, 200);
    await response.json();

    const requestLog = logs.find(({ label }) => label === "[request-timing]");
    assert.ok(requestLog);
    assert.equal(requestLog.details.endpoint, "GET /timed");
    assert.equal(requestLog.details.status, 200);
    assert.equal(typeof requestLog.details.middlewareMs, "number");
    assert.ok(Number(requestLog.details.databaseMs) >= 5);
    assert.ok(Number(requestLog.details.handlerMs) >= 5);
    assert.ok(Number(requestLog.details.totalMs) >= 5);
    assert.ok(
      logs.some(
        ({ label }) => label === "[request-timing] slowest endpoint observed in this instance",
      ),
    );
  } finally {
    console.info = originalInfo;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

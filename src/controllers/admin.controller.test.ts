import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import { errorHandler } from "../middleware/error-handler";
import { setAdminUserBlocked } from "./admin.controller";

type MongoCache = {
  client: MongoClient | null;
  database: Db | null;
  connection: Promise<Db> | null;
};

async function requestBlock(
  target: Record<string, unknown>,
  actorId: ObjectId,
): Promise<{ status: number; body: Record<string, unknown>; updateCalls: number }> {
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalDatabase = cache.database;
  let currentTarget = { ...target, isBlocked: false };
  let updateCalls = 0;

  cache.database = {
    collection: () => ({
      async findOne() {
        return currentTarget;
      },
      async updateOne() {
        updateCalls += 1;
        currentTarget = { ...currentTarget, isBlocked: true };
        return { matchedCount: 1 };
      },
    }),
  } as unknown as Db;

  const app = express();
  app.use(express.json());
  app.patch(
    "/users/:id/block",
    (request, _response, next) => {
      request.user = {
        _id: actorId,
        id: actorId.toHexString(),
        role: "admin",
      };
      next();
    },
    setAdminUserBlocked,
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
    const response = await fetch(
      `http://127.0.0.1:${address.port}/users/${target._id}/block`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: true }),
      },
    );
    return {
      status: response.status,
      body: await response.json() as Record<string, unknown>,
      updateCalls,
    };
  } finally {
    cache.database = originalDatabase;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("admins cannot block themselves", async () => {
  const adminId = new ObjectId();
  const result = await requestBlock(
    { _id: adminId, id: adminId.toHexString(), role: "admin" },
    adminId,
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { message: "Admins cannot block themselves" });
  assert.equal(result.updateCalls, 0);
});

test("admins cannot block another admin", async () => {
  const targetId = new ObjectId();
  const result = await requestBlock(
    { _id: targetId, id: targetId.toHexString(), role: "admin" },
    new ObjectId(),
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { message: "Admins cannot block another admin" });
  assert.equal(result.updateCalls, 0);
});

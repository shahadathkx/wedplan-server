import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Db, MongoClient } from "mongodb";
import { errorHandler } from "../middleware/error-handler";
import { getFeaturedServices } from "./public-services.controller";

test("featured services return an empty array and filter for approved available services", async () => {
  type MongoCache = {
    client: MongoClient | null;
    database: Db | null;
    connection: Promise<Db> | null;
  };
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalDatabase = cache.database;
  let observedFilter: unknown;

  cache.database = {
    collection: () => ({
      find(filter: unknown) {
        observedFilter = filter;
        const cursor = {
          sort: () => cursor,
          limit: () => cursor,
          toArray: async () => [],
        };
        return cursor;
      },
    }),
  } as unknown as Db;

  const app = express();
  app.get("/featured", getFeaturedServices);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/featured`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
    assert.deepEqual(observedFilter, { status: "approved", isAvailable: true });
  } finally {
    cache.database = originalDatabase;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

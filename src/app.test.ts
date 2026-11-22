import assert from "node:assert/strict";
import test from "node:test";
import type { Db, MongoClient } from "mongodb";

test("health endpoint starts without database and Stripe configuration", async () => {
  const keys = [
    "MONGODB_URI",
    "DB_NAME",
    "CLIENT_URL",
    "JWKS_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
  ];
  const originalValues = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    process.env[key] = "";
  }
  process.env.CLIENT_URL = "https://wedplan-client-eight.vercel.app";

  try {
    const { app } = await import("./app");
    const server = app.listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const preflight = await fetch(
        `http://127.0.0.1:${address.port}/api/services/featured`,
        {
          method: "OPTIONS",
          headers: {
            Origin: "https://wedplan-client-eight.vercel.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
          },
        },
      );
      assert.equal(preflight.status, 204);
      assert.equal(
        preflight.headers.get("access-control-allow-origin"),
        "https://wedplan-client-eight.vercel.app",
      );

      const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
        headers: { Origin: "https://wedplan-client-eight.vercel.app" },
      });
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("access-control-allow-origin"),
        "https://wedplan-client-eight.vercel.app",
      );
      assert.deepEqual(await response.json(), { status: "ok" });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    for (const [key, value] of originalValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("database connection failures return a JSON 500 response", async () => {
  const keys = ["MONGODB_URI", "DB_NAME"];
  const originalValues = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.DB_NAME = "wedplan";

  type MongoCache = {
    client: MongoClient | null;
    database: Db | null;
    connection: Promise<Db> | null;
  };
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalConnection = cache.connection;
  const originalDatabase = cache.database;
  const failedConnection = Promise.reject<Db>(new Error("database unavailable"));
  void failedConnection.catch(() => undefined);
  cache.connection = failedConnection;
  cache.database = null;

  try {
    const { app } = await import("./app");
    const server = app.listen(0, "127.0.0.1");

    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/services/featured`,
      );
      assert.equal(response.status, 500);
      assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
      assert.deepEqual(await response.json(), { message: "Internal server error" });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    cache.connection = originalConnection;
    cache.database = originalDatabase;
    for (const [key, value] of originalValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("malformed JSON bodies return a JSON 400 response", async () => {
  const keys = ["MONGODB_URI", "DB_NAME"];
  const originalValues = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  process.env.DB_NAME = "wedplan";

  type MongoCache = {
    client: MongoClient | null;
    database: Db | null;
    connection: Promise<Db> | null;
  };
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalConnection = cache.connection;
  const originalDatabase = cache.database;
  cache.connection = Promise.resolve({} as Db);

  try {
    const { app } = await import("./app");
    const server = app.listen(0, "127.0.0.1");

    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
      assert.deepEqual(await response.json(), { message: "Invalid JSON body" });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    cache.connection = originalConnection;
    cache.database = originalDatabase;
    for (const [key, value] of originalValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

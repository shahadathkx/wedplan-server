import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import {
  getMongoClientDiagnostics,
  warnMongoDatabaseNameMismatch,
} from "./mongodb";
import { getUserFromToken } from "./users";

type MongoCache = {
  client: MongoClient | null;
  database: Db | null;
  connection: Promise<Db> | null;
};

interface FindOneCall {
  filter: Record<string, unknown>;
  options?: Record<string, unknown>;
}

async function withMockUsers<T>(
  findOne: (
    filter: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>,
  run: (observedCalls: FindOneCall[], loggedErrors: unknown[][]) => Promise<T>,
): Promise<T> {
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalDatabase = cache.database;
  const originalClient = cache.client;
  const originalConsoleError = console.error;
  const observedCalls: FindOneCall[] = [];
  const loggedErrors: unknown[][] = [];
  console.error = (...args: unknown[]) => loggedErrors.push(args);

  cache.database = {
    collection(name: string) {
      assert.equal(name, "user");
      return {
        async findOne(
          filter: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) {
          observedCalls.push({ filter, options });
          return findOne(filter, options);
        },
      };
    },
  } as unknown as Db;
  cache.client = null;

  try {
    return await run(observedCalls, loggedErrors);
  } finally {
    cache.database = originalDatabase;
    cache.client = originalClient;
    console.error = originalConsoleError;
  }
}

test("user token lookup tries ObjectId, string _id, id, then email", async () => {
  const objectId = new ObjectId();
  const subject = objectId.toHexString();
  const user = { _id: objectId, email: "vendor@example.com", role: "vendor" as const };
  const filters = await withMockUsers(async (filter) => {
    if (filter.email === "vendor@example.com") {
      return user;
    }
    return null;
  }, async (observedCalls) => {
    const resolution = await getUserFromToken({
      sub: subject,
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "email");
    return observedCalls.map(({ filter }) => filter);
  });

  assert.deepEqual(filters, [
    { _id: objectId },
    { _id: subject },
    { id: subject },
    { email: "vendor@example.com" },
  ]);
});

test("user token lookup returns an ObjectId _id match first", async () => {
  const objectId = new ObjectId();
  const user = { _id: objectId, email: "vendor@example.com", role: "vendor" as const };
  const filters = await withMockUsers(async (filter) =>
    filter._id instanceof ObjectId ? user : null,
  async (observedCalls) => {
    const resolution = await getUserFromToken({
      sub: objectId.toHexString(),
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "sub_object_id");
    return observedCalls.map(({ filter }) => filter);
  });

  assert.deepEqual(filters, [{ _id: objectId }]);
});

test("user token lookup returns a string _id match before the id field", async () => {
  const subject = new ObjectId().toHexString();
  const user = { _id: subject, email: "vendor@example.com", role: "vendor" as const };
  const filters = await withMockUsers(async (filter) =>
    filter._id === subject ? user : null,
  async (observedCalls) => {
    const resolution = await getUserFromToken({
      sub: subject,
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "sub_string");
    return observedCalls.map(({ filter }) => filter);
  });

  assert.deepEqual(filters, [
    { _id: new ObjectId(subject) },
    { _id: subject },
  ]);
});

test("user token lookup stops at the first matching identifier", async () => {
  const subject = new ObjectId().toHexString();
  const user = { _id: subject, email: "vendor@example.com", role: "vendor" as const };
  const filters = await withMockUsers(async (filter) => {
    if (filter.id === subject) {
      return user;
    }
    return null;
  }, async (observedCalls) => {
    const resolution = await getUserFromToken({
      sub: subject,
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "id");
    return observedCalls.map(({ filter }) => filter);
  });

  assert.deepEqual(filters, [
    { _id: new ObjectId(subject) },
    { _id: subject },
    { id: subject },
  ]);
});

test("user token lookup resolves case-insensitive email after identifier misses", async () => {
  const user = { _id: new ObjectId(), email: "vendor@example.com", role: "vendor" as const };
  const filters = await withMockUsers(async (filter) =>
    filter.email === "VENDOR@EXAMPLE.COM" ? user : null,
  async (observedCalls) => {
    const resolution = await getUserFromToken({
      sub: "better-auth-id",
      email: "VENDOR@EXAMPLE.COM",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "email");
    return observedCalls;
  });

  assert.deepEqual(filters, [
    { filter: { _id: "better-auth-id" }, options: undefined },
    { filter: { id: "better-auth-id" }, options: undefined },
    {
      filter: { email: "VENDOR@EXAMPLE.COM" },
      options: { collation: { locale: "en", strength: 2 } },
    },
  ]);
});

test("user token lookup logs server-side diagnostics on a miss", async () => {
  const { calls, errors } = await withMockUsers(
    async () => null,
    async (observedCalls, loggedErrors) => {
      const resolution = await getUserFromToken({
        sub: "missing",
        email: "person@example.com",
      });
      assert.deepEqual(resolution, { user: null, matchedBy: null });
      return { calls: observedCalls, errors: loggedErrors };
    },
  );

  assert.deepEqual(calls.map(({ filter }) => filter), [
    { _id: "missing" },
    { id: "missing" },
    { email: "person@example.com" },
  ]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], "JWT user lookup missed");
  assert.deepEqual(errors[0][1], {
    sub: "missing",
    email: "person@example.com",
    configuredDatabaseName: process.env.DB_NAME ?? null,
    clientDatabaseName: null,
    selectedDatabaseName: null,
    collectionNames: [],
  });
});

test("user token lookup uses email when the token has no subject", async () => {
  const user = { _id: new ObjectId(), email: "person@example.com", role: "customer" as const };
  const calls = await withMockUsers(async (filter) =>
    filter.email === "person@example.com" ? user : null,
  async (observedCalls) => {
    const resolution = await getUserFromToken({ email: "person@example.com" });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "email");
    return observedCalls;
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].filter, { email: "person@example.com" });
});

test("MongoDB diagnostics use the client's default database and list its collections", async () => {
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalClient = cache.client;
  cache.client = {
    db() {
      return {
        databaseName: "uri-database",
        listCollections() {
          return {
            toArray: async () => [{ name: "bookings" }, { name: "user" }],
          };
        },
      };
    },
  } as unknown as MongoClient;

  try {
    assert.deepEqual(await getMongoClientDiagnostics(), {
      databaseName: "uri-database",
      selectedDatabaseName: null,
      collectionNames: ["bookings", "user"],
    });
  } finally {
    cache.client = originalClient;
  }
});

test("MongoDB startup warning identifies a URI database mismatch", () => {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);

  try {
    warnMongoDatabaseNameMismatch(
      "mongodb+srv://user:password@example.mongodb.net/uri-db",
      "configured-db",
    );
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, [[
    "MongoDB URI database differs from DB_NAME",
    {
      uriDatabaseName: "uri-db",
      configuredDatabaseName: "configured-db",
    },
  ]]);
});

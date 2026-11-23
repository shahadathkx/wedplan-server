import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import { getUserFromToken } from "./users";

type MongoCache = {
  client: MongoClient | null;
  database: Db | null;
  connection: Promise<Db> | null;
};

async function withMockUsers<T>(
  findOne: (filter: Record<string, unknown>) => Promise<unknown>,
  run: (observedFilters: Record<string, unknown>[]) => Promise<T>,
): Promise<T> {
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalDatabase = cache.database;
  const observedFilters: Record<string, unknown>[] = [];

  cache.database = {
    collection(name: string) {
      assert.equal(name, "user");
      return {
        async findOne(filter: Record<string, unknown>) {
          observedFilters.push(filter);
          return findOne(filter);
        },
      };
    },
  } as unknown as Db;

  try {
    return await run(observedFilters);
  } finally {
    cache.database = originalDatabase;
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
  }, async (observedFilters) => {
    const resolution = await getUserFromToken({
      sub: subject,
      id: "better-auth-id",
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "email");
    return observedFilters;
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
  async (observedFilters) => {
    const resolution = await getUserFromToken({
      sub: objectId.toHexString(),
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "sub_object_id");
    return observedFilters;
  });

  assert.deepEqual(filters, [{ _id: objectId }]);
});

test("user token lookup returns a string _id match before the id field", async () => {
  const subject = new ObjectId().toHexString();
  const user = { _id: subject, email: "vendor@example.com", role: "vendor" as const };
  const filters = await withMockUsers(async (filter) =>
    filter._id === subject ? user : null,
  async (observedFilters) => {
    const resolution = await getUserFromToken({
      sub: subject,
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "sub_string");
    return observedFilters;
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
  }, async (observedFilters) => {
    const resolution = await getUserFromToken({
      sub: subject,
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "id");
    return observedFilters;
  });

  assert.deepEqual(filters, [
    { _id: new ObjectId(subject) },
    { _id: subject },
    { id: subject },
  ]);
});

test("user token lookup can resolve a non-ObjectId subject by email", async () => {
  const user = { _id: new ObjectId(), email: "vendor@example.com", role: "vendor" as const };
  const filters = await withMockUsers(async (filter) =>
    filter.email === "vendor@example.com" ? user : null,
  async (observedFilters) => {
    const resolution = await getUserFromToken({
      sub: "better-auth-id",
      email: "vendor@example.com",
    });
    assert.equal(resolution.user, user);
    assert.equal(resolution.matchedBy, "email");
    return observedFilters;
  });

  assert.deepEqual(filters, [
    { _id: "better-auth-id" },
    { id: "better-auth-id" },
    { email: "vendor@example.com" },
  ]);
});

test("user token lookup returns no match without matching claims", async () => {
  const filters = await withMockUsers(async () => null, async (observedFilters) => {
    const resolution = await getUserFromToken({ sub: "missing" });
    assert.deepEqual(resolution, { user: null, matchedBy: null });
    return observedFilters;
  });

  assert.deepEqual(filters, [{ _id: "missing" }, { id: "missing" }]);
});

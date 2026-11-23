import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId, type Db, type MongoClient } from "mongodb";
import { AppError } from "./errors";
import {
  assertAvailableServiceCapacity,
  downgradeVendorToFree,
  withVendorServiceCapacityLock,
} from "./service-capacity";

test("vendor service capacity lock serializes concurrent serverless mutations", async () => {
  type MongoCache = {
    client: MongoClient | null;
    database: Db | null;
    connection: Promise<Db> | null;
  };
  type UpdateDocument = {
    $set?: Record<string, unknown>;
    $unset?: Record<string, unknown>;
  };

  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);

  const originalDatabase = cache.database;
  const vendorId = new ObjectId();
  let token: string | undefined;
  let expiresAt: Date | undefined;
  const users = {
    async updateOne(filter: unknown, update: UpdateDocument) {
      const nextToken = update.$set?.serviceCapacityLockToken;
      if (typeof nextToken === "string") {
        if (token && expiresAt && expiresAt > new Date()) {
          return { matchedCount: 0 };
        }
        const nextExpiry = update.$set?.serviceCapacityLockExpiresAt;
        assert.ok(nextExpiry instanceof Date);
        token = nextToken;
        expiresAt = nextExpiry;
        return { matchedCount: 1 };
      }

      if (update.$unset) {
        const filterText = JSON.stringify(filter);
        if (token && filterText.includes(token)) {
          token = undefined;
          expiresAt = undefined;
        }
      }
      return { matchedCount: 1 };
    },
  };
  cache.database = {
    collection: () => users,
  } as unknown as Db;

  let activeMutations = 0;
  let peakMutations = 0;
  const mutate = () =>
    withVendorServiceCapacityLock(vendorId, async () => {
      activeMutations += 1;
      peakMutations = Math.max(peakMutations, activeMutations);
      await new Promise<void>((resolve) => setTimeout(resolve, 40));
      activeMutations -= 1;
    });

  try {
    await Promise.all([mutate(), mutate()]);
    assert.equal(peakMutations, 1);
    assert.equal(token, undefined);
  } finally {
    cache.database = originalDatabase;
  }
});

test("free-plan capacity rejects the fourth non-rejected available service", async () => {
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
  const vendorId = new ObjectId();
  let observedFilter: unknown;

  cache.database = {
    collection: () => ({
      countDocuments: async (filter: unknown) => {
        observedFilter = filter;
        return 3;
      },
    }),
  } as unknown as Db;

  try {
    await assert.rejects(
      assertAvailableServiceCapacity(vendorId),
      (error: unknown) => error instanceof AppError && error.statusCode === 403,
    );
    assert.deepEqual(observedFilter, {
      vendorId,
      isAvailable: true,
      status: { $ne: "rejected" },
    });
  } finally {
    cache.database = originalDatabase;
  }
});

test("Premium downgrade keeps the newest three services available", async () => {
  type MongoCache = {
    client: MongoClient | null;
    database: Db | null;
    connection: Promise<Db> | null;
  };
  type UpdateDocument = {
    $set?: Record<string, unknown>;
    $unset?: Record<string, unknown>;
  };
  const cache = (globalThis as typeof globalThis & {
    wedplanMongoCache?: MongoCache;
  }).wedplanMongoCache;
  assert.ok(cache);
  const originalDatabase = cache.database;
  const vendorId = new ObjectId();
  const overflow = [{ _id: new ObjectId() }, { _id: new ObjectId() }];
  let observedFilter: unknown;
  let observedSort: unknown;
  let observedSkip: number | undefined;
  let disabledIds: unknown;
  let plan: unknown;
  let token: string | undefined;
  let expiresAt: Date | undefined;

  const users = {
    async updateOne(filter: unknown, update: UpdateDocument) {
      const nextToken = update.$set?.serviceCapacityLockToken;
      if (typeof nextToken === "string") {
        if (token && expiresAt && expiresAt > new Date()) {
          return { matchedCount: 0 };
        }
        const nextExpiry = update.$set?.serviceCapacityLockExpiresAt;
        assert.ok(nextExpiry instanceof Date);
        token = nextToken;
        expiresAt = nextExpiry;
        return { matchedCount: 1 };
      }

      if (update.$unset) {
        token = undefined;
        expiresAt = undefined;
      } else {
        plan = update.$set?.subscriptionPlan;
      }
      return { matchedCount: 1 };
    },
  };
  const services = {
    find(filter: unknown) {
      observedFilter = filter;
      const cursor = {
        sort(sort: unknown) {
          observedSort = sort;
          return cursor;
        },
        skip(count: number) {
          observedSkip = count;
          return cursor;
        },
        toArray: async () => overflow,
      };
      return cursor;
    },
    async updateMany(filter: { _id?: { $in?: unknown[] } }) {
      disabledIds = filter._id?.$in;
      return { matchedCount: overflow.length };
    },
  };
  cache.database = {
    collection: (name: string) => (name === "user" ? users : services),
  } as unknown as Db;

  try {
    await downgradeVendorToFree(vendorId);
    assert.equal(plan, "free");
    assert.deepEqual(observedFilter, {
      vendorId,
      isAvailable: true,
      status: { $ne: "rejected" },
    });
    assert.deepEqual(observedSort, { createdAt: -1, _id: -1 });
    assert.equal(observedSkip, 3);
    assert.deepEqual(disabledIds, overflow.map(({ _id }) => _id));
    assert.equal(token, undefined);
  } finally {
    cache.database = originalDatabase;
  }
});

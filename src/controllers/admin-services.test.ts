import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Db, MongoClient } from "mongodb";
import { errorHandler } from "../middleware/error-handler";
import { listAdminServices } from "./admin-services.controller";

test("admin service list filters by category and joins vendor details", async () => {
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
  let observedPipeline: unknown;
  let observedFilter: unknown;
  const result = {
    services: [{ serviceName: "Venue", vendor: { name: "Vendor Name" } }],
    total: 1,
  };

  cache.database = {
    collection: () => ({
      aggregate(pipeline: unknown) {
        observedPipeline = pipeline;
        return { toArray: async () => result.services };
      },
      async countDocuments(filter: unknown) {
        observedFilter = filter;
        return result.total;
      },
    }),
  } as unknown as Db;

  const app = express();
  app.get("/services", listAdminServices);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const query = new URLSearchParams({
      q: "Photo.*",
      status: "pending",
      category: "Wedding Venues",
      page: "2",
      limit: "4",
    });
    const response = await fetch(
      `http://127.0.0.1:${address.port}/services?${query.toString()}`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      services: result.services,
      pagination: { page: 2, limit: 4, total: 1, totalPages: 1 },
    });
    assert.deepEqual(observedFilter, {
      status: "pending",
      category: "Wedding Venues",
      serviceName: { $regex: "Photo\\.\\*", $options: "i" },
    });
    assert.deepEqual(observedPipeline, [
      {
        $match: {
          status: "pending",
          category: "Wedding Venues",
          serviceName: { $regex: "Photo\\.\\*", $options: "i" },
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: 4 },
      { $limit: 4 },
      {
        $lookup: {
          from: "user",
          let: { vendorId: "$vendorId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$vendorId"] },
                    { $eq: ["$id", "$$vendorId"] },
                    { $eq: [{ $toString: "$_id" }, "$$vendorId"] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                name: 1,
                email: 1,
                image: 1,
                businessName: 1,
              },
            },
          ],
          as: "vendor",
        },
      },
      { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
    ]);
  } finally {
    cache.database = originalDatabase;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

import { Db, MongoClient } from "mongodb";

type MongoConnectionCache = {
  client: MongoClient | null;
  database: Db | null;
  connection: Promise<Db> | null;
};

const globalForMongo = globalThis as typeof globalThis & {
  wedplanMongoCache?: MongoConnectionCache;
};

const cache = (globalForMongo.wedplanMongoCache ??= {
  client: null,
  database: null,
  connection: null,
});

async function createIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection("services").createIndexes([
      {
        key: { status: 1, isAvailable: 1, category: 1, price: 1 },
        name: "services_public_search",
      },
      {
        key: { vendorId: 1, createdAt: -1 },
        name: "services_vendor_created",
      },
    ]),
    database.collection("bookings").createIndexes([
      {
        key: { customerId: 1, createdAt: -1 },
        name: "bookings_customer_created",
      },
      {
        key: { customerId: 1, serviceId: 1, eventDate: 1, status: 1 },
        name: "bookings_customer_service_date_status",
      },
      {
        key: { customerId: 1, serviceId: 1, eventDate: 1 },
        name: "bookings_active_unique",
        unique: true,
        partialFilterExpression: {
          $or: [{ status: "pending" }, { status: "accepted" }],
        },
      },
      {
        key: { vendorId: 1, createdAt: -1 },
        name: "bookings_vendor_created",
      },
    ]),
    database.collection("transactions").createIndex(
      { stripeSessionId: 1 },
      { unique: true, name: "transactions_stripe_session_unique" },
    ),
  ]);
}

export function connectToDatabase(
  uri: string,
  databaseName: string,
): Promise<Db> {
  if (cache.connection) {
    return cache.connection;
  }

  const mongoClient = new MongoClient(uri);
  cache.client = mongoClient;
  cache.connection = (async () => {
    await mongoClient.connect();
    const database = mongoClient.db(databaseName);
    await createIndexes(database);
    cache.database = database;
    return database;
  })().catch(async (error: unknown) => {
    await mongoClient.close();
    cache.client = null;
    cache.database = null;
    cache.connection = null;
    throw error;
  });

  return cache.connection;
}

export function getDatabase(): Db {
  if (!cache.database) {
    throw new Error("MongoDB has not been connected");
  }

  return cache.database;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (cache.client) {
    await cache.client.close();
  }
  cache.client = null;
  cache.database = null;
  cache.connection = null;
}

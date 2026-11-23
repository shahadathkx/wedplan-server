import { Db, MongoClient } from "mongodb";
import {
  recordDatabaseCommandFailed,
  recordDatabaseCommandFinished,
  recordDatabaseCommandStarted,
} from "../middleware/request-timing";

type MongoConnectionCache = {
  client: MongoClient | null;
  database: Db | null;
  connection: Promise<Db> | null;
  indexes: Promise<void> | null;
};

const globalForMongo = globalThis as typeof globalThis & {
  wedplanMongoCache?: MongoConnectionCache;
};

const cache = (globalForMongo.wedplanMongoCache ??= {
  client: null,
  database: null,
  connection: null,
  indexes: null,
});

async function createIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection("services").createIndexes([
      {
        key: { status: 1, isAvailable: 1, createdAt: -1, _id: -1 },
        name: "services_public_featured",
      },
      {
        key: { status: 1, isAvailable: 1, category: 1, price: 1, _id: 1 },
        name: "services_public_category_price",
      },
      {
        key: { status: 1, createdAt: -1, _id: -1 },
        name: "services_admin_status_created",
      },
      {
        key: { status: 1, isAvailable: 1, category: 1, price: 1 },
        name: "services_public_search",
      },
      {
        key: { vendorId: 1, createdAt: -1 },
        name: "services_vendor_created",
      },
      {
        key: { vendorId: 1, status: 1, isAvailable: 1 },
        name: "services_vendor_stats",
      },
      {
        key: { vendorId: 1, isAvailable: 1, createdAt: -1, _id: -1 },
        name: "services_vendor_available_created",
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
      {
        key: { vendorId: 1, status: 1 },
        name: "bookings_vendor_stats",
      },
      {
        key: { customerId: 1, status: 1, eventDate: 1 },
        name: "bookings_customer_stats",
      },
    ]),
    database.collection("user").createIndexes([
      {
        key: { createdAt: -1, _id: -1 },
        name: "users_admin_created",
      },
      {
        key: { role: 1, createdAt: -1, _id: -1 },
        name: "users_admin_role_created",
      },
    ]),
    database.collection("transactions").createIndex(
      { createdAt: -1, _id: -1 },
      { name: "transactions_admin_created" },
    ),
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

  const mongoClient = new MongoClient(uri, { monitorCommands: true });
  mongoClient.on("commandStarted", recordDatabaseCommandStarted);
  mongoClient.on("commandSucceeded", recordDatabaseCommandFinished);
  mongoClient.on("commandFailed", recordDatabaseCommandFailed);
  cache.client = mongoClient;
  cache.connection = (async () => {
    await mongoClient.connect();
    const clientDatabase = mongoClient.db();
    const database = mongoClient.db(databaseName);
    cache.database = database;
    cache.indexes ??= createIndexes(database);
    await cache.indexes;
    const [clientCollections, selectedCollections] = await Promise.all([
      clientDatabase.listCollections({}, { nameOnly: true }).toArray(),
      database.listCollections({}, { nameOnly: true }).toArray(),
    ]);

    console.info("MongoDB connected", {
      clientDatabaseName: clientDatabase.databaseName,
      configuredDatabaseName: process.env.DB_NAME ?? databaseName,
      selectedDatabaseName: database.databaseName,
      clientCollectionNames: clientCollections.map(({ name }) => name).sort(),
      selectedCollectionNames: selectedCollections.map(({ name }) => name).sort(),
    });
    if (clientDatabase.databaseName !== databaseName) {
      console.warn("MongoDB client default database differs from DB_NAME", {
        clientDatabaseName: clientDatabase.databaseName,
        configuredDatabaseName: process.env.DB_NAME ?? databaseName,
        selectedDatabaseName: database.databaseName,
      });
    }

    return database;
  })().catch(async (error: unknown) => {
    await mongoClient.close();
    cache.client = null;
    cache.database = null;
    cache.connection = null;
    cache.indexes = null;
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

export async function getMongoClientDiagnostics(): Promise<{
  databaseName: string | null;
  selectedDatabaseName: string | null;
  collectionNames: string[];
}> {
  if (!cache.client) {
    return {
      databaseName: null,
      selectedDatabaseName: cache.database?.databaseName ?? null,
      collectionNames: [],
    };
  }

  const database = cache.client.db();
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  return {
    databaseName: database.databaseName,
    selectedDatabaseName: cache.database?.databaseName ?? null,
    collectionNames: collections.map(({ name }) => name).sort(),
  };
}

export async function closeDatabaseConnection(): Promise<void> {
  if (cache.client) {
    await cache.client.close();
  }
  cache.client = null;
  cache.database = null;
  cache.connection = null;
  cache.indexes = null;
}

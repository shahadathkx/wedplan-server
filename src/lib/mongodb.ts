import { Db, MongoClient } from "mongodb";

let client: MongoClient | null = null;
let databaseInstance: Db | null = null;
let connection: Promise<Db> | null = null;

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
        key: { customerId: 1, serviceId: 1, eventDate: 1, status: 1 },
        name: "bookings_customer_service_date_status",
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
  if (connection) {
    return connection;
  }

  const mongoClient = new MongoClient(uri);
  client = mongoClient;
  connection = (async () => {
    await mongoClient.connect();
    const database = mongoClient.db(databaseName);
    await createIndexes(database);
    databaseInstance = database;
    return database;
  })().catch(async (error: unknown) => {
    await mongoClient.close();
    client = null;
    databaseInstance = null;
    connection = null;
    throw error;
  });

  return connection;
}

export function getDatabase(): Db {
  if (!databaseInstance) {
    throw new Error("MongoDB has not been connected");
  }

  return databaseInstance;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
  }
  client = null;
  databaseInstance = null;
  connection = null;
}

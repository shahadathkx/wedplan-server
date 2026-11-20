import "dotenv/config";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { closeDatabaseConnection, connectToDatabase } from "../src/lib/mongodb";

const seedEnvironmentSchema = z.object({
  MONGODB_URI: z.string().min(1),
  DB_NAME: z.string().min(1),
  ADMIN_EMAIL: z.string().email().transform((email) => email.toLowerCase()),
  ADMIN_NAME: z.string().trim().min(1),
});

interface AdminUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: null;
  createdAt: Date;
  updatedAt: Date;
  role: "admin";
  isBlocked: boolean;
  businessName: null;
  subscriptionPlan: "free";
  subscriptionExpiresAt: null;
}

async function seedAdmin(): Promise<void> {
  const parsed = seedEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid admin seed configuration: ${details}`);
  }

  const { MONGODB_URI, DB_NAME, ADMIN_EMAIL, ADMIN_NAME } = parsed.data;
  const database = await connectToDatabase(MONGODB_URI, DB_NAME);
  const users = database.collection<AdminUser>("user");
  const existingUser = await users.findOne({ email: ADMIN_EMAIL });

  if (existingUser) {
    if (existingUser.role !== "admin") {
      throw new Error(
        `Cannot seed ${ADMIN_EMAIL}: that email is already assigned to a non-admin user`,
      );
    }

    console.log(`Admin user ${ADMIN_EMAIL} already exists; no changes made.`);
    return;
  }

  const id = randomUUID();
  const now = new Date();
  await users.insertOne({
    _id: id,
    id,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
    role: "admin",
    isBlocked: false,
    businessName: null,
    subscriptionPlan: "free",
    subscriptionExpiresAt: null,
  });

  console.log(`Created admin user ${ADMIN_EMAIL}.`);
}

seedAdmin()
  .catch((error: unknown) => {
    console.error("Admin seeding failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDatabaseConnection();
    } catch (error) {
      console.error("Failed to close MongoDB connection", error);
      process.exitCode = 1;
    }
  });

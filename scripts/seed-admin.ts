import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { MongoServerError, ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { closeDatabaseConnection, connectToDatabase } from "../src/lib/mongodb";

const seedEnvironmentSchema = z.object({
  MONGODB_URI: z.string().trim().min(1),
  DB_NAME: z.string().trim().min(1),
  ADMIN_EMAIL: z.string().email().transform((email) => email.toLowerCase()),
  ADMIN_NAME: z.string().trim().min(1),
  ADMIN_PASSWORD: z
    .string()
    .regex(
      /(?=.*[a-z])(?=.*[A-Z]).{6,}/,
      "Admin password must be at least 6 characters and include an uppercase and a lowercase letter",
    ),
});

interface SeedAdminConfig {
  email: string;
  name: string;
  password: string;
}

interface AdminUser {
  _id?: ObjectId | string;
  id?: string;
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

interface CredentialAccount {
  _id?: ObjectId;
  accountId: string;
  providerId: "credential";
  userId: ObjectId | string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function seedAdmin(
  database: Db,
  config: SeedAdminConfig,
): Promise<"created" | "promoted"> {
  const users = database.collection<AdminUser>("user");
  const existingUser = await users.findOne({ email: config.email });

  if (existingUser) {
    const result = await users.updateOne(
      { _id: existingUser._id },
      { $set: { role: "admin" } },
    );
    if (result.matchedCount !== 1) {
      throw new Error("Existing admin user changed while the seed was running");
    }
    return "promoted";
  }

  const now = new Date();
  const userRecordId = new ObjectId();
  const userId = userRecordId.toString();
  const user: AdminUser = {
    _id: userRecordId,
    id: userId,
    name: config.name,
    email: config.email,
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
    role: "admin",
    isBlocked: false,
    businessName: null,
    subscriptionPlan: "free",
    subscriptionExpiresAt: null,
  };
  const passwordHash = await hashPassword(config.password);

  try {
    await users.insertOne(user);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const concurrentUser = await users.findOne({ email: config.email });
      if (concurrentUser) {
        const result = await users.updateOne(
          { _id: concurrentUser._id },
          { $set: { role: "admin" } },
        );
        if (result.matchedCount === 1) {
          return "promoted";
        }
      }
    }
    throw error;
  }

  const accounts = database.collection<CredentialAccount>("account");
  try {
    await accounts.insertOne({
      userId: userRecordId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    try {
      await users.deleteOne({ _id: userRecordId });
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Failed to create the admin credential and remove its partial user record",
      );
    }
    throw error;
  }

  return "created";
}

async function main(): Promise<void> {
  const parsed = seedEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid admin seed configuration: ${details}`);
  }

  const { MONGODB_URI, DB_NAME, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = parsed.data;
  const database = await connectToDatabase(MONGODB_URI, DB_NAME);
  const result = await seedAdmin(database, {
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    password: ADMIN_PASSWORD,
  });

  if (result === "created") {
    console.log(`Created verified admin account for ${ADMIN_EMAIL}.`);
  } else {
    console.log(`Set existing user ${ADMIN_EMAIL} role to admin.`);
  }
}

if (require.main === module) {
  void main()
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
}

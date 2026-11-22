import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { closeDatabaseConnection, connectToDatabase } from "../src/lib/mongodb";

const seedEnvironmentSchema = z.object({
  MONGODB_URI: z.string().min(1),
  DB_NAME: z.string().min(1),
  ADMIN_EMAIL: z.string().email().transform((email) => email.toLowerCase()),
  ADMIN_NAME: z.string().trim().min(1),
  ADMIN_PASSWORD: z
    .string()
    .regex(
      /(?=.*[a-z])(?=.*[A-Z]).{6,}/,
      "Admin password must be at least 6 characters and include an uppercase and a lowercase letter",
    ),
});

interface AdminUser {
  _id: string | ObjectId;
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
  userId: string | ObjectId;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

async function seedAdmin(): Promise<void> {
  const parsed = seedEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid admin seed configuration: ${details}`);
  }

  const { MONGODB_URI, DB_NAME, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = parsed.data;
  const database = await connectToDatabase(MONGODB_URI, DB_NAME);
  const users = database.collection<AdminUser>("user");
  const existingUser = await users.findOne({ email: ADMIN_EMAIL });

  if (existingUser) {
    if (existingUser.role !== "admin") {
      throw new Error(
        `Cannot seed ${ADMIN_EMAIL}: that email is already assigned to a non-admin user`,
      );
    }

  }

  const now = new Date();
  const userRecordId = existingUser?._id ?? new ObjectId();
  const id = existingUser?.id ?? userRecordId.toString();
  if (!existingUser) {
    await users.insertOne({
      _id: userRecordId,
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
  }

  const accounts = database.collection<CredentialAccount>("account");
  const existingCredential = await accounts.findOne({
    providerId: "credential",
    accountId: id,
  });
  if (!existingCredential) {
    await accounts.insertOne({
      userId: userRecordId,
      providerId: "credential",
      accountId: id,
      password: await hashPassword(ADMIN_PASSWORD),
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Admin sign-in enabled for ${ADMIN_EMAIL}.`);
  } else {
    console.log(`Admin user ${ADMIN_EMAIL} already has a password sign-in.`);
  }
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

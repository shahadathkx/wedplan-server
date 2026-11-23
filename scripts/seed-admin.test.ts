import assert from "node:assert/strict";
import test from "node:test";
import { verifyPassword } from "better-auth/crypto";
import { ObjectId, type Db } from "mongodb";
import { seedAdmin } from "./seed-admin.js";

interface StoredUser {
  _id: ObjectId | string;
  id?: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: null;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  isBlocked: boolean;
  businessName: null;
  subscriptionPlan: "free";
  subscriptionExpiresAt: null;
}

interface StoredAccount {
  userId: ObjectId | string;
  accountId: string;
  providerId: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

function createMemoryDatabase(initialUser?: StoredUser, initialAccount?: StoredAccount) {
  let user = initialUser;
  const accounts = initialAccount ? [initialAccount] : [];
  const updates: Array<{ filter: unknown; update: unknown }> = [];
  const usersCollection = {
    async findOne(filter: { email?: string }) {
      return user?.email === filter.email ? user : null;
    },
    async insertOne(document: StoredUser) {
      user = document;
      return { insertedId: document._id };
    },
    async updateOne(filter: { _id?: ObjectId | string }, update: { $set: { role: string } }) {
      updates.push({ filter, update });
      if (user && filter._id === user._id) {
        user.role = update.$set.role;
        return { matchedCount: 1 };
      }
      return { matchedCount: 0 };
    },
  };
  const accountsCollection = {
    async insertOne(document: StoredAccount) {
      accounts.push(document);
      return { insertedId: new ObjectId() };
    },
  };
  const database = {
    collection(name: string) {
      return name === "user" ? usersCollection : accountsCollection;
    },
  } as unknown as Db;

  return {
    database,
    getUser: () => user,
    accounts,
    updates,
  };
}

test("admin seed creates a verified admin with Better Auth credential hash", async () => {
  const memory = createMemoryDatabase();
  const password = "StrongAdminPass1";
  const result = await seedAdmin(memory.database, {
    email: "admin@example.com",
    name: "WedPlan Admin",
    password,
  });

  const user = memory.getUser();
  assert.equal(result, "created");
  assert.ok(user);
  assert.equal(user.emailVerified, true);
  assert.equal(user.role, "admin");
  assert.equal(user.isBlocked, false);
  assert.equal(user.name, "WedPlan Admin");
  assert.ok(user._id);
  assert.equal(memory.accounts.length, 1);
  assert.equal(memory.accounts[0].providerId, "credential");
  assert.equal(memory.accounts[0].accountId, user._id.toString());
  assert.equal(memory.accounts[0].userId, user._id);
  assert.notEqual(memory.accounts[0].password, password);
  assert.equal(
    await verifyPassword({ hash: memory.accounts[0].password, password }),
    true,
  );
  assert.equal(
    await verifyPassword({
      hash: memory.accounts[0].password,
      password: "NotTheAdminPassword1",
    }),
    false,
  );

  const savedPasswordHash = memory.accounts[0].password;
  const rerunResult = await seedAdmin(memory.database, {
    email: "admin@example.com",
    name: "Changed Name",
    password: "ChangedPassword2",
  });
  assert.equal(rerunResult, "promoted");
  assert.equal(memory.accounts.length, 1);
  assert.equal(memory.accounts[0].password, savedPasswordHash);
  assert.equal(memory.getUser()?.name, "WedPlan Admin");
  assert.deepEqual(memory.updates, [
    {
      filter: { _id: user._id },
      update: { $set: { role: "admin" } },
    },
  ]);
});

test("rerunning the seed only changes an existing user's role", async () => {
  const userId = new ObjectId();
  const user: StoredUser = {
    _id: userId,
    id: userId.toHexString(),
    name: "Existing User",
    email: "existing@example.com",
    emailVerified: false,
    image: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    role: "vendor",
    isBlocked: true,
    businessName: null,
    subscriptionPlan: "free",
    subscriptionExpiresAt: null,
  };
  const account: StoredAccount = {
    userId,
    accountId: userId.toHexString(),
    providerId: "credential",
    password: "existing-hash",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  const memory = createMemoryDatabase(user, account);

  const result = await seedAdmin(memory.database, {
    email: user.email,
    name: "Ignored Replacement Name",
    password: "StrongAdminPass1",
  });

  assert.equal(result, "promoted");
  assert.equal(user.role, "admin");
  assert.equal(user.name, "Existing User");
  assert.equal(user.emailVerified, false);
  assert.equal(user.isBlocked, true);
  assert.deepEqual(memory.accounts, [account]);
  assert.deepEqual(memory.updates, [
    { filter: { _id: userId }, update: { $set: { role: "admin" } } },
  ]);
});

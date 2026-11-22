import assert from "node:assert/strict";
import test from "node:test";
import {
  getDatabaseConfig,
  getJwksUrl,
  getStripeSecretKey,
} from "./env";

test("configuration is validated when the related feature is used", () => {
  assert.throws(() => getDatabaseConfig({}), /MONGODB_URI is missing or invalid/);
  assert.throws(() => getJwksUrl({}), /JWKS_URL is missing or invalid/);
  assert.throws(() => getStripeSecretKey({}), /STRIPE_SECRET_KEY is missing or invalid/);
});

test("database configuration requires both connection values", () => {
  assert.throws(
    () => getDatabaseConfig({ MONGODB_URI: "mongodb://localhost:27017" }),
    /DB_NAME is missing or invalid/,
  );
  assert.deepEqual(
    getDatabaseConfig({
      MONGODB_URI: "mongodb://localhost:27017",
      DB_NAME: "wedplan",
    }),
    { uri: "mongodb://localhost:27017", databaseName: "wedplan" },
  );
});

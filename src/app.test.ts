import assert from "node:assert/strict";
import test from "node:test";

test("health endpoint starts without database and Stripe configuration", async () => {
  const keys = [
    "MONGODB_URI",
    "DB_NAME",
    "CLIENT_URL",
    "JWKS_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
  ];
  const originalValues = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    process.env[key] = "";
  }

  try {
    const { app } = await import("./app");
    const server = app.listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    for (const [key, value] of originalValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

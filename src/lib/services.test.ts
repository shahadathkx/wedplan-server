import assert from "node:assert/strict";
import test from "node:test";
import {
  adminServicesQuerySchema,
  availabilitySchema,
  createServiceSchema,
  escapeRegex,
  publicServicesQuerySchema,
  serviceStatusSchema,
  updateServiceSchema,
} from "./services";
import { parseObjectId } from "./object-id";
import {
  hasExpiredPremiumSubscription,
  hasPremiumSubscription,
} from "./users";

const validService = {
  serviceName: "Golden Hour Photography",
  category: "Photography & Videography",
  description: "Wedding photography packages for your special day.",
  price: 2500,
  location: "Dhaka",
  images: ["https://images.example.com/wedding.jpg"],
} as const;

test("service creation defaults availability and rejects server-managed fields", () => {
  const parsed = createServiceSchema.parse(validService);
  assert.equal(parsed.isAvailable, true);
  assert.throws(() => createServiceSchema.parse({ ...validService, status: "approved" }));
  assert.throws(() => createServiceSchema.parse({ ...validService, vendorId: "attacker" }));
});

test("service updates require editable fields and reject empty or protected updates", () => {
  assert.deepEqual(updateServiceSchema.parse({ price: 3000 }), { price: 3000 });
  assert.throws(() => updateServiceSchema.parse({}));
  assert.throws(() => updateServiceSchema.parse({ isAvailable: false }));
});

test("public and admin service queries enforce filters and bounded pagination", () => {
  assert.deepEqual(
    publicServicesQuerySchema.parse({ category: validService.category, sort: "price_desc" }),
    {
      category: validService.category,
      sort: "price_desc",
      page: 1,
      limit: 12,
    },
  );
  assert.equal(adminServicesQuerySchema.parse({ status: "pending" }).limit, 12);
  assert.throws(() => publicServicesQuerySchema.parse({ page: "0" }));
  assert.throws(() => publicServicesQuerySchema.parse({ sort: "random" }));
  assert.throws(() => adminServicesQuerySchema.parse({ role: "admin" }));
});

test("availability and moderation accept only server-defined values", () => {
  assert.deepEqual(availabilitySchema.parse({ isAvailable: false }), { isAvailable: false });
  assert.throws(() => availabilitySchema.parse({ isAvailable: "false" }));
  assert.deepEqual(serviceStatusSchema.parse({ status: "approved" }), { status: "approved" });
  assert.throws(() => serviceStatusSchema.parse({ status: "published" }));
});

test("search text is escaped and only 24-character hexadecimal ObjectIds are accepted", () => {
  assert.equal(escapeRegex("photo.*"), "photo\\.\\*");
  assert.throws(() => parseObjectId("123456789012"));
  assert.throws(() => parseObjectId("not-an-object-id"));
  assert.equal(parseObjectId("0123456789abcdef01234567").toHexString(), "0123456789abcdef01234567");
});

test("expired Premium subscriptions are treated as free for service limits", () => {
  assert.equal(hasPremiumSubscription({ subscriptionPlan: "free" }), false);
  assert.equal(hasExpiredPremiumSubscription({ subscriptionPlan: "free" }), false);
  assert.equal(hasPremiumSubscription({ subscriptionPlan: "premium" }), true);
  assert.equal(hasExpiredPremiumSubscription({ subscriptionPlan: "premium" }), false);
  const expiredUser = {
    subscriptionPlan: "premium" as const,
    subscriptionExpiresAt: new Date(Date.now() - 60_000),
  };
  assert.equal(
    hasPremiumSubscription(expiredUser),
    false,
  );
  assert.equal(hasExpiredPremiumSubscription(expiredUser), true);
});

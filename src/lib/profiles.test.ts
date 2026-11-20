import assert from "node:assert/strict";
import test from "node:test";
import {
  adminUsersQuerySchema,
  blockUserSchema,
  updateProfileSchema,
} from "./profiles";

test("profile updates allow only name, image, and business name", () => {
  assert.deepEqual(updateProfileSchema.parse({ name: "  Alex  " }), {
    name: "Alex",
  });
  assert.deepEqual(updateProfileSchema.parse({ image: null, businessName: null }), {
    image: null,
    businessName: null,
  });
  assert.throws(() => updateProfileSchema.parse({ role: "admin" }));
  assert.throws(() => updateProfileSchema.parse({ isBlocked: true }));
  assert.throws(() => updateProfileSchema.parse({ subscriptionPlan: "premium" }));
  assert.throws(() => updateProfileSchema.parse({}));
  assert.throws(() => updateProfileSchema.parse({ image: "javascript:alert(1)" }));
});

test("admin user filters and block changes validate their inputs", () => {
  assert.deepEqual(adminUsersQuerySchema.parse({ q: "  Alex ", role: "vendor" }), {
    q: "Alex",
    role: "vendor",
    page: 1,
    limit: 20,
  });
  assert.throws(() => adminUsersQuerySchema.parse({ role: "owner" }));
  assert.throws(() => blockUserSchema.parse({ isBlocked: "true" }));
  assert.throws(() => blockUserSchema.parse({ isBlocked: true, role: "admin" }));
});

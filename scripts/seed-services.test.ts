import assert from "node:assert/strict";
import test from "node:test";
import { seedServices } from "./seed-services";

test("service seed contains exactly ten complete listings", () => {
  assert.equal(seedServices.length, 10);

  for (const service of seedServices) {
    assert.ok(service.serviceName.trim());
    assert.ok(service.category);
    assert.equal(service.location.includes(","), true);
    assert.equal(Number.isFinite(service.price), true);
    assert.equal(service.description.split(/[.!?]+/).filter(Boolean).length >= 2, true);
    assert.equal(service.images.length, 3);
    for (const imageUrl of service.images) {
      const url = new URL(imageUrl);
      assert.equal(url.protocol, "https:");
      assert.equal(url.hostname, "images.unsplash.com");
      assert.equal(url.searchParams.get("auto"), "format");
      assert.equal(url.searchParams.get("fit"), "crop");
      assert.equal(url.searchParams.get("w"), "1200");
      assert.equal(url.searchParams.get("q"), "80");
    }
  }

  assert.equal(
    new Set(seedServices.map((service) => service.serviceName)).size,
    10,
  );
});

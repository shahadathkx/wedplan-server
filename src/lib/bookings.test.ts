import assert from "node:assert/strict";
import test from "node:test";
import { createBookingSchema, vendorBookingActionSchema } from "./bookings";

const validBooking = {
  serviceId: "0123456789abcdef01234567",
  eventDate: "2027-01-15",
  eventLocation: "Dhaka",
};

test("booking creation validates fields and normalizes event dates", () => {
  const parsed = createBookingSchema.parse(validBooking);
  assert.equal(parsed.eventDate.toISOString(), "2027-01-15T00:00:00.000Z");
  assert.equal(parsed.message, "");
  assert.equal(
    createBookingSchema.parse({
      ...validBooking,
      eventDate: "2027-01-15T18:45:00+06:00",
    }).eventDate.toISOString(),
    "2027-01-15T00:00:00.000Z",
  );
});

test("booking requests reject malformed IDs, dates, locations, and client-controlled fields", () => {
  assert.throws(() => createBookingSchema.parse({ ...validBooking, serviceId: "bad-id" }));
  assert.throws(() => createBookingSchema.parse({ ...validBooking, eventDate: "2027-02-30" }));
  assert.throws(() => createBookingSchema.parse({ ...validBooking, eventLocation: " " }));
  assert.throws(() => createBookingSchema.parse({ ...validBooking, status: "accepted" }));
});

test("vendors can submit only accept or reject actions", () => {
  assert.deepEqual(vendorBookingActionSchema.parse({ action: "accept" }), { action: "accept" });
  assert.deepEqual(vendorBookingActionSchema.parse({ action: "reject" }), { action: "reject" });
  assert.throws(() => vendorBookingActionSchema.parse({ action: "cancel" }));
  assert.throws(() => vendorBookingActionSchema.parse({ action: "accept", status: "accepted" }));
});

import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";
import {
  vendorBookingActionSchema,
  type BookingRecord,
} from "../lib/bookings";
import { parseObjectId } from "../lib/object-id";
import { bookingPopulationPipeline } from "../lib/populate-bookings";
import { emptyQuerySchema } from "../lib/services";
import { getDatabase } from "../lib/mongodb";
import { getUserObjectId } from "../lib/users";
import { parseInput } from "../lib/validation";

export const listVendorBookings: RequestHandler = async (request, response) => {
  parseInput(emptyQuerySchema, request.query);
  const bookings = await getDatabase()
    .collection<BookingRecord>("bookings")
    .aggregate(bookingPopulationPipeline({ vendorId: getUserObjectId(request.user) }))
    .toArray();

  response.status(200).json({ bookings });
};

export const updateVendorBookingStatus: RequestHandler = async (request, response) => {
  const { action } = parseInput(vendorBookingActionSchema, request.body);
  const vendorId = getUserObjectId(request.user);
  const bookingId = parseObjectId(request.params.id, "booking id");
  const collection = getDatabase().collection<BookingRecord>("bookings");
  const status = action === "accept" ? "accepted" : "rejected";
  const result = await collection.updateOne(
    { _id: bookingId, vendorId, status: "pending" },
    { $set: { status } },
  );

  if (result.matchedCount === 0) {
    const booking = await collection.findOne(
      { _id: bookingId, vendorId },
      { projection: { status: 1 } },
    );
    if (!booking) {
      throw new AppError(404, "Booking not found");
    }
    throw new AppError(400, "Only pending bookings can be accepted or rejected");
  }

  const booking = await collection.findOne({ _id: bookingId, vendorId });
  if (!booking) {
    throw new AppError(404, "Booking not found");
  }

  response.status(200).json({ booking });
};

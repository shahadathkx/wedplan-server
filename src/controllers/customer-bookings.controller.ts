import type { RequestHandler } from "express";
import { MongoServerError, ObjectId } from "mongodb";
import { AppError } from "../lib/errors";
import { parseObjectId } from "../lib/object-id";
import {
  createBookingSchema,
  emptyBodySchema,
  type BookingRecord,
} from "../lib/bookings";
import { bookingPopulationPipeline } from "../lib/populate-bookings";
import { emptyQuerySchema, type ServiceRecord } from "../lib/services";
import { getDatabase } from "../lib/mongodb";
import { getUserObjectId } from "../lib/users";
import { parseInput } from "../lib/validation";

export const createCustomerBooking: RequestHandler = async (request, response) => {
  const input = parseInput(createBookingSchema, request.body);
  const customerId = getUserObjectId(request.user);
  const serviceId = parseObjectId(input.serviceId, "service id");
  const service = await getDatabase()
    .collection<ServiceRecord>("services")
    .findOne({ _id: serviceId, status: "approved", isAvailable: true });

  if (!service) {
    throw new AppError(404, "Service not found");
  }
  if (service.vendorId.equals(customerId)) {
    throw new AppError(400, "You cannot book your own service");
  }

  const bookings = getDatabase().collection<BookingRecord>("bookings");
  const duplicate = await bookings.findOne({
    customerId,
    serviceId,
    eventDate: input.eventDate,
    status: { $in: ["pending", "accepted"] },
  });
  if (duplicate) {
    throw new AppError(400, "An active booking already exists for this service and event date");
  }

  const booking: BookingRecord = {
    _id: new ObjectId(),
    serviceId,
    vendorId: service.vendorId,
    customerId,
    eventDate: input.eventDate,
    eventLocation: input.eventLocation,
    message: input.message,
    status: "pending",
    createdAt: new Date(),
  };
  try {
    await bookings.insertOne(booking);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new AppError(400, "An active booking already exists for this service and event date");
    }
    throw error;
  }

  response.status(201).json({ booking });
};

export const listCustomerBookings: RequestHandler = async (request, response) => {
  parseInput(emptyQuerySchema, request.query);
  const bookings = await getDatabase()
    .collection<BookingRecord>("bookings")
    .aggregate(bookingPopulationPipeline({ customerId: getUserObjectId(request.user) }))
    .toArray();

  response.status(200).json({ bookings });
};

export const cancelCustomerBooking: RequestHandler = async (request, response) => {
  parseInput(emptyBodySchema, request.body);
  const customerId = getUserObjectId(request.user);
  const bookingId = parseObjectId(request.params.id, "booking id");
  const collection = getDatabase().collection<BookingRecord>("bookings");
  const result = await collection.updateOne(
    { _id: bookingId, customerId, status: "pending" },
    { $set: { status: "cancelled" } },
  );

  if (result.matchedCount === 0) {
    const booking = await collection.findOne(
      { _id: bookingId, customerId },
      { projection: { status: 1 } },
    );
    if (!booking) {
      throw new AppError(404, "Booking not found");
    }
    throw new AppError(400, "Only pending bookings can be cancelled");
  }

  const booking = await collection.findOne({ _id: bookingId, customerId });
  if (!booking) {
    throw new AppError(404, "Booking not found");
  }

  response.status(200).json({ booking });
};

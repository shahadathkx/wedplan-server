import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { AppError } from "../lib/errors";
import { parseObjectId } from "../lib/object-id";
import { BookingRecord, createBookingSchema } from "../lib/bookings";
import { ServiceRecord } from "../lib/services";
import { getDatabase } from "../lib/mongodb";
import { getUserId } from "../lib/users";
import { parseInput } from "../lib/validation";

export const createCustomerBooking: RequestHandler = async (request, response) => {
  const input = parseInput(createBookingSchema, request.body);
  const customerId = getUserId(request.user);
  const serviceId = parseObjectId(input.serviceId, "service id");
  const service = await getDatabase()
    .collection<ServiceRecord>("services")
    .findOne({ _id: serviceId, status: "approved", isAvailable: true });

  if (!service) {
    throw new AppError(404, "Service not found");
  }
  if (service.vendorId === customerId) {
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
  await bookings.insertOne(booking);

  response.status(201).json({ booking });
};

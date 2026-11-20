import type { RequestHandler } from "express";
import { getDatabase } from "../lib/mongodb";
import { getUserId } from "../lib/users";
import { type BookingRecord } from "../lib/bookings";
import { type ServiceRecord } from "../lib/services";

export const getVendorStats: RequestHandler = async (request, response) => {
  const vendorId = getUserId(request.user);
  const database = getDatabase();
  const services = database.collection<ServiceRecord>("services");
  const bookings = database.collection<BookingRecord>("bookings");

  const [
    totalServices,
    availableServices,
    pendingServices,
    totalBookings,
    pendingBookings,
    acceptedBookings,
    rejectedBookings,
    cancelledBookings,
  ] = await Promise.all([
    services.countDocuments({ vendorId }),
    services.countDocuments({
      vendorId,
      isAvailable: true,
      status: { $ne: "rejected" },
    }),
    services.countDocuments({ vendorId, status: "pending" }),
    bookings.countDocuments({ vendorId }),
    bookings.countDocuments({ vendorId, status: "pending" }),
    bookings.countDocuments({ vendorId, status: "accepted" }),
    bookings.countDocuments({ vendorId, status: "rejected" }),
    bookings.countDocuments({ vendorId, status: "cancelled" }),
  ]);

  response.status(200).json({
    stats: {
      totalServices,
      availableServices,
      pendingServices,
      totalBookings,
      pendingBookings,
      acceptedBookings,
      rejectedBookings,
      cancelledBookings,
    },
  });
};

export const getCustomerStats: RequestHandler = async (request, response) => {
  const customerId = getUserId(request.user);
  const bookings = getDatabase().collection<BookingRecord>("bookings");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [
    totalBookings,
    pendingBookings,
    acceptedBookings,
    upcomingBookings,
    rejectedBookings,
    cancelledBookings,
  ] = await Promise.all([
    bookings.countDocuments({ customerId }),
    bookings.countDocuments({ customerId, status: "pending" }),
    bookings.countDocuments({ customerId, status: "accepted" }),
    bookings.countDocuments({
      customerId,
      status: { $in: ["pending", "accepted"] },
      eventDate: { $gte: today },
    }),
    bookings.countDocuments({ customerId, status: "rejected" }),
    bookings.countDocuments({ customerId, status: "cancelled" }),
  ]);

  response.status(200).json({
    stats: {
      totalBookings,
      pendingBookings,
      acceptedBookings,
      upcomingBookings,
      rejectedBookings,
      cancelledBookings,
    },
  });
};

import type { Document, ObjectId } from "mongodb";
import { z } from "zod";

export const bookingStatuses = ["pending", "accepted", "rejected", "cancelled"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export interface BookingRecord extends Document {
  _id: ObjectId;
  serviceId: ObjectId;
  vendorId: string;
  customerId: string;
  eventDate: Date;
  eventLocation: string;
  message: string;
  status: BookingStatus;
  createdAt: Date;
}

export const createBookingSchema = z
  .object({
    serviceId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid service id"),
    eventDate: z
      .union([z.iso.date(), z.iso.datetime({ offset: true })])
      .transform((value) => new Date(value.slice(0, 10))),
    eventLocation: z.string().trim().min(2).max(200),
    message: z.string().trim().max(2000).optional().default(""),
  })
  .strict();

export const vendorBookingActionSchema = z
  .object({
    action: z.enum(["accept", "reject"]),
  })
  .strict();

export const emptyBodySchema = z.object({}).strict().optional();

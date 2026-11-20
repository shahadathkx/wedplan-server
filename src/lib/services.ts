import type { Document, ObjectId } from "mongodb";
import { z } from "zod";

export const serviceCategories = [
  "Photography & Videography",
  "Wedding Venues",
  "Decoration & Florist",
  "Catering Services",
  "Makeup & Styling",
  "Wedding Fashion",
] as const;

export const serviceStatuses = ["pending", "approved", "rejected"] as const;

export type ServiceCategory = (typeof serviceCategories)[number];
export type ServiceStatus = (typeof serviceStatuses)[number];

export interface ServiceRecord extends Document {
  _id: ObjectId;
  vendorId: string;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: ServiceStatus;
  isAvailable: boolean;
  createdAt: Date;
}

const serviceNameSchema = z.string().trim().min(2).max(120);
const categorySchema = z.enum(serviceCategories);
const descriptionSchema = z.string().trim().min(1).max(5000);
const priceSchema = z.number().finite().min(0).max(1_000_000_000);
const locationSchema = z.string().trim().min(2).max(200);
const imageUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Image URLs must use HTTP or HTTPS");
const imagesSchema = z.array(imageUrlSchema).max(10);

export const createServiceSchema = z
  .object({
    serviceName: serviceNameSchema,
    category: categorySchema,
    description: descriptionSchema,
    price: priceSchema,
    location: locationSchema,
    images: imagesSchema,
    isAvailable: z.boolean().default(true),
  })
  .strict();

export const updateServiceSchema = z
  .object({
    serviceName: serviceNameSchema,
    category: categorySchema,
    description: descriptionSchema,
    price: priceSchema,
    location: locationSchema,
    images: imagesSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const availabilitySchema = z
  .object({
    isAvailable: z.boolean(),
  })
  .strict();

export const publicServicesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    category: categorySchema.optional(),
    location: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(["price_asc", "price_desc"]).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict();

export const adminServicesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    status: z.enum(serviceStatuses).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict();

export const serviceStatusSchema = z
  .object({
    status: z.enum(serviceStatuses),
  })
  .strict();

export const emptyQuerySchema = z.object({}).strict();

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

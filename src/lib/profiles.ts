import { z } from "zod";

const imageSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Image URLs must use HTTP or HTTPS")
  .nullable();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    image: imageSchema,
    businessName: z.string().trim().min(1).max(160).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const adminUsersQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    role: z.enum(["customer", "vendor", "admin"]).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const blockUserSchema = z
  .object({
    isBlocked: z.boolean(),
  })
  .strict();

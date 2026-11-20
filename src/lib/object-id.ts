import { ObjectId } from "mongodb";
import { AppError } from "./errors";

export function parseObjectId(value: unknown, label = "id"): ObjectId {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw new AppError(400, `Invalid ${label}`);
  }
  return new ObjectId(value);
}

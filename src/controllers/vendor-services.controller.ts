import type { Request, RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { AppError } from "../lib/errors";
import { parseObjectId } from "../lib/object-id";
import {
  availabilitySchema,
  createServiceSchema,
  emptyQuerySchema,
  updateServiceSchema,
  type ServiceRecord,
} from "../lib/services";
import { getDatabase } from "../lib/mongodb";
import { getUserId, hasPremiumSubscription } from "../lib/users";
import { parseInput } from "../lib/validation";

const FREE_AVAILABLE_SERVICE_LIMIT = 3;

async function assertAvailableServiceCapacity(vendorId: string): Promise<void> {
  const count = await getDatabase()
    .collection<ServiceRecord>("services")
    .countDocuments({
      vendorId,
      isAvailable: true,
      status: { $ne: "rejected" },
    });

  if (count >= FREE_AVAILABLE_SERVICE_LIMIT) {
    throw new AppError(
      403,
      "Free plan allows up to 3 non-rejected available services. Upgrade to Premium or disable another service.",
    );
  }
}

export const listVendorServices: RequestHandler = async (request, response) => {
  parseInput(emptyQuerySchema, request.query);
  const services = await getDatabase()
    .collection<ServiceRecord>("services")
    .find({ vendorId: getUserId(request.user) })
    .sort({ createdAt: -1, _id: -1 })
    .toArray();

  response.status(200).json({ services });
};

export const createVendorService: RequestHandler = async (request, response) => {
  const input = parseInput(createServiceSchema, request.body);
  const vendorId = getUserId(request.user);

  if (input.isAvailable && !hasPremiumSubscription(request.user)) {
    await assertAvailableServiceCapacity(vendorId);
  }

  const service: ServiceRecord = {
    _id: new ObjectId(),
    vendorId,
    serviceName: input.serviceName,
    category: input.category,
    description: input.description,
    price: input.price,
    location: input.location,
    images: input.images,
    status: "pending",
    isAvailable: input.isAvailable,
    createdAt: new Date(),
  };
  await getDatabase().collection<ServiceRecord>("services").insertOne(service);

  response.status(201).json({ service });
};

export const updateVendorService: RequestHandler = async (request, response) => {
  const input = parseInput(updateServiceSchema, request.body);
  const vendorId = getUserId(request.user);
  const serviceId = parseObjectId(request.params.id, "service id");
  const collection = getDatabase().collection<ServiceRecord>("services");
  const result = await collection.updateOne(
    { _id: serviceId, vendorId },
    { $set: input },
  );

  if (result.matchedCount === 0) {
    throw new AppError(404, "Service not found");
  }

  const service = await collection.findOne({ _id: serviceId, vendorId });
  if (!service) {
    throw new AppError(404, "Service not found");
  }

  response.status(200).json({ service });
};

export const deleteVendorService: RequestHandler = async (request, response) => {
  const vendorId = getUserId(request.user);
  const result = await getDatabase()
    .collection<ServiceRecord>("services")
    .deleteOne({ _id: parseObjectId(request.params.id, "service id"), vendorId });

  if (result.deletedCount === 0) {
    throw new AppError(404, "Service not found");
  }

  response.status(204).end();
};

export const setVendorServiceAvailability: RequestHandler = async (request, response) => {
  const input = parseInput(availabilitySchema, request.body);
  const vendorId = getUserId(request.user);
  const serviceId = parseObjectId(request.params.id, "service id");
  const collection = getDatabase().collection<ServiceRecord>("services");
  const service = await collection.findOne({ _id: serviceId, vendorId });

  if (!service) {
    throw new AppError(404, "Service not found");
  }

  if (
    input.isAvailable &&
    !service.isAvailable &&
    service.status !== "rejected" &&
    !hasPremiumSubscription(request.user)
  ) {
    await assertAvailableServiceCapacity(vendorId);
  }

  await collection.updateOne(
    { _id: serviceId, vendorId },
    { $set: { isAvailable: input.isAvailable } },
  );
  const updatedService = await collection.findOne({ _id: serviceId, vendorId });
  if (!updatedService) {
    throw new AppError(404, "Service not found");
  }

  response.status(200).json({ service: updatedService });
};

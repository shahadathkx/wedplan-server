import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";
import { parseObjectId } from "../lib/object-id";
import {
  adminServicesQuerySchema,
  escapeRegex,
  ServiceRecord,
  serviceStatusSchema,
} from "../lib/services";
import { getDatabase } from "../lib/mongodb";
import { parseInput } from "../lib/validation";

export const listAdminServices: RequestHandler = async (request, response) => {
  const query = parseInput(adminServicesQuerySchema, request.query);
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }
  if (query.q) {
    filter.serviceName = { $regex: escapeRegex(query.q), $options: "i" };
  }

  const collection = getDatabase().collection<ServiceRecord>("services");
  const [services, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  response.status(200).json({
    services,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
};

export const setAdminServiceStatus: RequestHandler = async (request, response) => {
  const { status } = parseInput(serviceStatusSchema, request.body);
  const serviceId = parseObjectId(request.params.id, "service id");
  const collection = getDatabase().collection<ServiceRecord>("services");
  const result = await collection.updateOne({ _id: serviceId }, { $set: { status } });

  if (result.matchedCount === 0) {
    throw new AppError(404, "Service not found");
  }

  const service = await collection.findOne({ _id: serviceId });
  if (!service) {
    throw new AppError(404, "Service not found");
  }

  response.status(200).json({ service });
};

export const deleteAdminService: RequestHandler = async (request, response) => {
  const serviceId = parseObjectId(request.params.id, "service id");
  const result = await getDatabase()
    .collection<ServiceRecord>("services")
    .deleteOne({ _id: serviceId });

  if (result.deletedCount === 0) {
    throw new AppError(404, "Service not found");
  }

  response.status(204).end();
};

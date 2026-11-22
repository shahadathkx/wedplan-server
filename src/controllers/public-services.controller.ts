import type { RequestHandler } from "express";
import { type Sort } from "mongodb";
import { AppError } from "../lib/errors";
import { parseObjectId } from "../lib/object-id";
import { escapeRegex, publicServicesQuerySchema, type ServiceRecord } from "../lib/services";
import { getDatabase } from "../lib/mongodb";
import { parseInput } from "../lib/validation";

export const listPublicServices: RequestHandler = async (request, response) => {
  const query = parseInput(publicServicesQuerySchema, request.query);
  const filter: Record<string, unknown> = {
    status: "approved",
    isAvailable: true,
  };

  if (query.category) {
    filter.category = query.category;
  }
  if (query.q) {
    filter.serviceName = { $regex: escapeRegex(query.q), $options: "i" };
  }
  if (query.location) {
    filter.location = { $regex: escapeRegex(query.location), $options: "i" };
  }

  const collection = getDatabase().collection<ServiceRecord>("services");
  const direction = query.sort === "price_asc" ? 1 : query.sort === "price_desc" ? -1 : null;
  const sort: Sort =
    direction === null
      ? { createdAt: -1, _id: -1 }
      : { price: direction, _id: 1 };
  const [services, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sort)
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

export const getFeaturedServices: RequestHandler = async (_request, response) => {
  const services = await getDatabase()
    .collection<ServiceRecord>("services")
    .find({ status: "approved", isAvailable: true })
    .sort({ createdAt: -1, _id: -1 })
    .limit(6)
    .toArray();

  response.status(200).json(services);
};

export const getPublicServiceById: RequestHandler = async (request, response) => {
  const service = await getDatabase()
    .collection<ServiceRecord>("services")
    .findOne({ _id: parseObjectId(request.params.id, "service id"), status: "approved", isAvailable: true });

  if (!service) {
    throw new AppError(404, "Service not found");
  }

  response.status(200).json({ service });
};

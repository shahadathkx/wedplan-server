import type { RequestHandler } from "express";
import type { Filter } from "mongodb";
import { AppError } from "../lib/errors";
import { getDatabase } from "../lib/mongodb";
import {
  adminUsersQuerySchema,
  blockUserSchema,
} from "../lib/profiles";
import { getUserId, userIdFilter, type UserRecord } from "../lib/users";
import { escapeRegex } from "../lib/services";
import { parseInput } from "../lib/validation";

function adminUserResponse(user: UserRecord) {
  return {
    id: getUserId(user),
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    role: user.role ?? null,
    isBlocked: user.isBlocked ?? false,
    businessName: user.businessName ?? null,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
    createdAt: user.createdAt ?? null,
  };
}

export const getAdminStats: RequestHandler = async (_request, response) => {
  const database = getDatabase();
  const users = database.collection<UserRecord>("user");
  const services = database.collection("services");
  const bookings = database.collection("bookings");
  const transactions = database.collection("transactions");

  const [
    totalUsers,
    totalCustomers,
    totalVendors,
    blockedUsers,
    totalServices,
    pendingServices,
    approvedServices,
    totalBookings,
    pendingBookings,
    acceptedBookings,
    totalTransactions,
    revenueByCurrency,
  ] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ role: "customer" }),
    users.countDocuments({ role: "vendor" }),
    users.countDocuments({ isBlocked: true }),
    services.countDocuments({}),
    services.countDocuments({ status: "pending" }),
    services.countDocuments({ status: "approved" }),
    bookings.countDocuments({}),
    bookings.countDocuments({ status: "pending" }),
    bookings.countDocuments({ status: "accepted" }),
    transactions.countDocuments({}),
    transactions.aggregate<{ _id: string; amount: number }>([
      { $match: { status: "paid" } },
      { $group: { _id: "$currency", amount: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ]);

  response.status(200).json({
    stats: {
      totalUsers,
      totalCustomers,
      totalVendors,
      blockedUsers,
      totalServices,
      pendingServices,
      approvedServices,
      totalBookings,
      pendingBookings,
      acceptedBookings,
      totalTransactions,
      revenueByCurrency: revenueByCurrency.map(({ _id, amount }) => ({
        currency: _id,
        amount,
      })),
    },
  });
};

export const listAdminUsers: RequestHandler = async (request, response) => {
  const query = parseInput(adminUsersQuerySchema, request.query);
  const clauses: Filter<UserRecord>[] = [];
  if (query.role) {
    clauses.push({ role: query.role });
  }
  if (query.q) {
    const search = { $regex: escapeRegex(query.q), $options: "i" };
    clauses.push({
      $or: [
        { name: search },
        { email: search },
        { businessName: search },
      ],
    });
  }

  const filter: Filter<UserRecord> =
    clauses.length > 1 ? { $and: clauses } : clauses[0] ?? {};
  const users = getDatabase().collection<UserRecord>("user");
  const [results, total] = await Promise.all([
    users
      .find(filter, {
        projection: {
          id: 1,
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          isBlocked: 1,
          businessName: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .toArray(),
    users.countDocuments(filter),
  ]);

  response.status(200).json({
    users: results.map(adminUserResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
};

export const getAdminUser: RequestHandler = async (request, response) => {
  const userId = request.params.id;
  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid user id");
  }
  const user = await getDatabase()
    .collection<UserRecord>("user")
    .findOne(userIdFilter(userId), {
      projection: {
        id: 1,
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
        businessName: 1,
        subscriptionPlan: 1,
        subscriptionExpiresAt: 1,
        createdAt: 1,
      },
    });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  response.status(200).json({ user: adminUserResponse(user) });
};

export const setAdminUserBlocked: RequestHandler = async (request, response) => {
  const { isBlocked } = parseInput(blockUserSchema, request.body);
  const userId = request.params.id;
  if (typeof userId !== "string") {
    throw new AppError(400, "Invalid user id");
  }
  if (isBlocked) {
    const selfIds = [request.user?.id, request.user?._id?.toString()];
    if (selfIds.includes(userId)) {
      throw new AppError(400, "Admins cannot block themselves");
    }
  }

  const users = getDatabase().collection<UserRecord>("user");
  const result = await users.updateOne(
    userIdFilter(userId),
    { $set: { isBlocked, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    throw new AppError(404, "User not found");
  }

  const user = await users.findOne(userIdFilter(userId), {
    projection: {
      id: 1,
      name: 1,
      email: 1,
      image: 1,
      role: 1,
      isBlocked: 1,
      businessName: 1,
      subscriptionPlan: 1,
      subscriptionExpiresAt: 1,
      createdAt: 1,
    },
  });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  response.status(200).json({ user: adminUserResponse(user) });
};

export const listAdminTransactions: RequestHandler = async (request, response) => {
  const query = parseInput(adminUsersQuerySchema.pick({
    page: true,
    limit: true,
  }), request.query);
  const transactions = getDatabase().collection("transactions");
  const [results, total] = await Promise.all([
    transactions
      .aggregate([
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (query.page - 1) * query.limit },
        { $limit: query.limit },
        {
          $lookup: {
            from: "user",
            let: { vendorId: "$vendorId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$id", "$$vendorId"] },
                      { $eq: [{ $toString: "$_id" }, "$$vendorId"] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  id: 1,
                  name: 1,
                  email: 1,
                  businessName: 1,
                },
              },
            ],
            as: "vendor",
          },
        },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            vendorId: 1,
            plan: 1,
            amount: 1,
            currency: 1,
            stripeSessionId: 1,
            stripeSubscriptionId: 1,
            status: 1,
            createdAt: 1,
            vendor: 1,
          },
        },
      ])
      .toArray(),
    transactions.countDocuments({}),
  ]);

  response.status(200).json({
    transactions: results,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
};

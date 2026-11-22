import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import { AppError } from "./errors";
import { getDatabase } from "./mongodb";
import type { ServiceRecord } from "./services";
import {
  hasExpiredPremiumSubscription,
  hasPremiumSubscription,
  userIdFilter,
  type UserRecord,
} from "./users";

type LockableUser = UserRecord & {
  serviceCapacityLockToken?: string;
  serviceCapacityLockExpiresAt?: Date;
};

const FREE_AVAILABLE_SERVICE_LIMIT = 3;
const LOCK_LEASE_MS = 120_000;
const LOCK_WAIT_MS = 5_000;
const LOCK_RETRY_MS = 25;

async function updateVendorSubscription(
  vendorId: string,
  subscriptionPlan: "free" | "premium",
  subscriptionExpiresAt: Date | null,
): Promise<void> {
  const result = await getDatabase()
    .collection<UserRecord>("user")
    .updateOne(
      { ...userIdFilter(vendorId), role: "vendor" },
      { $set: { subscriptionPlan, subscriptionExpiresAt } },
    );

  if (result.matchedCount === 0) {
    throw new AppError(404, "Vendor not found");
  }
}

async function disableAvailableServicesBeyondLimit(vendorId: string): Promise<void> {
  const services = getDatabase().collection<ServiceRecord>("services");
  const overflow = await services
    .find(
      {
        vendorId,
        isAvailable: true,
        status: { $ne: "rejected" },
      },
      { projection: { _id: 1 } },
    )
    .sort({ createdAt: -1, _id: -1 })
    .skip(FREE_AVAILABLE_SERVICE_LIMIT)
    .toArray();

  if (overflow.length > 0) {
    await services.updateMany(
      {
        _id: { $in: overflow.map(({ _id }) => _id) },
        vendorId,
        isAvailable: true,
        status: { $ne: "rejected" },
      },
      { $set: { isAvailable: false } },
    );
  }
}

export async function withVendorServiceCapacityLock<T>(
  vendorId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const users = getDatabase().collection<LockableUser>("user");
  const lockToken = randomUUID();
  const deadline = Date.now() + LOCK_WAIT_MS;
  const identityFilter: Filter<LockableUser> = userIdFilter(vendorId);

  while (Date.now() < deadline) {
    const now = new Date();
    const result = await users.updateOne(
      {
        $and: [
          identityFilter,
          {
            $or: [
              { serviceCapacityLockExpiresAt: { $exists: false } },
              { serviceCapacityLockExpiresAt: { $lte: now } },
            ],
          },
        ],
      },
      {
        $set: {
          serviceCapacityLockToken: lockToken,
          serviceCapacityLockExpiresAt: new Date(now.getTime() + LOCK_LEASE_MS),
        },
      },
    );

    if (result.matchedCount > 0) {
      try {
        return await operation();
      } finally {
        await users.updateOne(
          {
            $and: [identityFilter, { serviceCapacityLockToken: lockToken }],
          },
          {
            $unset: {
              serviceCapacityLockToken: "",
              serviceCapacityLockExpiresAt: "",
            },
          },
        );
      }
    }

    await new Promise<void>((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }

  throw new AppError(503, "Service capacity is busy; retry the request");
}

export async function activateVendorPremium(
  vendorId: string,
  subscriptionExpiresAt: Date,
): Promise<void> {
  await withVendorServiceCapacityLock(vendorId, () =>
    updateVendorSubscription(vendorId, "premium", subscriptionExpiresAt),
  );
}

export async function downgradeVendorToFree(vendorId: string): Promise<void> {
  await withVendorServiceCapacityLock(vendorId, async () => {
    await disableAvailableServicesBeyondLimit(vendorId);
    await updateVendorSubscription(vendorId, "free", null);
  });
}

export async function expireVendorPremiumIfDue(vendorId: string): Promise<boolean> {
  return withVendorServiceCapacityLock(vendorId, async () => {
    const users = getDatabase().collection<UserRecord>("user");
    const vendor = await users.findOne(userIdFilter(vendorId));
    if (!vendor) {
      throw new AppError(404, "Vendor not found");
    }
    if (vendor.role !== "vendor" || !hasExpiredPremiumSubscription(vendor)) {
      return false;
    }

    await disableAvailableServicesBeyondLimit(vendorId);
    const result = await users.updateOne(
      {
        ...userIdFilter(vendorId),
        role: "vendor",
        subscriptionPlan: "premium",
        subscriptionExpiresAt: vendor.subscriptionExpiresAt,
      },
      { $set: { subscriptionPlan: "free", subscriptionExpiresAt: null } },
    );
    return result.matchedCount > 0;
  });
}

export async function assertAvailableServiceCapacity(vendorId: string): Promise<void> {
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

export async function vendorHasPremiumPlan(vendorId: string): Promise<boolean> {
  const vendor = await getDatabase()
    .collection<UserRecord>("user")
    .findOne(userIdFilter(vendorId));

  if (!vendor) {
    throw new AppError(404, "Vendor not found");
  }
  if (vendor.isBlocked) {
    throw new AppError(403, "User is blocked");
  }

  return hasPremiumSubscription(vendor);
}

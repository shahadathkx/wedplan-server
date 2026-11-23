import type { Document } from "mongodb";

export function bookingPopulationPipeline(match: Document): Document[] {
  return [
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $lookup: {
        from: "services",
        localField: "serviceId",
        foreignField: "_id",
        as: "service",
      },
    },
    { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "user",
        let: { relatedUserId: "$customerId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$_id", "$$relatedUserId"] },
                  { $eq: ["$id", "$$relatedUserId"] },
                  { $eq: [{ $toString: "$_id" }, "$$relatedUserId"] },
                ],
              },
            },
          },
          { $project: { name: 1, email: 1, image: 1, businessName: 1 } },
        ],
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "user",
        let: { relatedUserId: "$vendorId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$_id", "$$relatedUserId"] },
                  { $eq: ["$id", "$$relatedUserId"] },
                  { $eq: [{ $toString: "$_id" }, "$$relatedUserId"] },
                ],
              },
            },
          },
          { $project: { name: 1, email: 1, image: 1, businessName: 1 } },
        ],
        as: "vendor",
      },
    },
    { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
  ];
}

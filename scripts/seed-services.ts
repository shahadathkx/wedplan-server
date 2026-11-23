import "dotenv/config";
import { type Db, ObjectId } from "mongodb";
import { z } from "zod";
import { closeDatabaseConnection, connectToDatabase } from "../src/lib/mongodb";
import { getUserObjectId } from "../src/lib/users";

const seedEnvironmentSchema = z.object({
  MONGODB_URI: z.string().trim().min(1),
  DB_NAME: z.string().trim().min(1),
});

type ServiceCategory =
  | "Photography & Videography"
  | "Wedding Venues"
  | "Decoration & Florist"
  | "Catering Services"
  | "Makeup & Styling"
  | "Wedding Fashion";

export interface SeedService {
  serviceName: string;
  category: ServiceCategory;
  price: number;
  location: string;
  description: string;
  images: string[];
}

interface StoredService {
  _id?: ObjectId;
  vendorId: ObjectId;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: "approved";
  isAvailable: true;
  createdAt: Date;
}

interface UserRecord {
  _id?: ObjectId | string;
  id?: string;
  role?: "customer" | "vendor" | "admin";
}

const imageParams = "?auto=format&fit=crop&w=1200&q=80";
const unsplash = (photoId: string) =>
  `https://images.unsplash.com/${photoId}${imageParams}`;

export const seedServices: SeedService[] = [
  {
    serviceName: "Golden Hour Photography",
    category: "Photography & Videography",
    price: 1800,
    location: "Austin, TX",
    description:
      "Golden Hour Photography creates warm, artful wedding portraits and thoughtful documentary coverage across Austin. The team captures candid emotions and polished details with a relaxed, unobtrusive approach.",
    images: [
      unsplash("photo-1519741497674-611481863552"),
      unsplash("photo-1511285560929-80b456fea0bc"),
      unsplash("photo-1464366400600-7168b8af9bc3"),
    ],
  },
  {
    serviceName: "Cinematic Vows Films",
    category: "Photography & Videography",
    price: 2400,
    location: "Los Angeles, CA",
    description:
      "Cinematic Vows Films produces elegant wedding films with natural sound, intimate vows, and beautifully paced storytelling. Each Los Angeles production is planned around the couple's most meaningful moments.",
    images: [
      unsplash("photo-1511285560929-80b456fea0bc"),
      unsplash("photo-1464366400600-7168b8af9bc3"),
      unsplash("photo-1478146896981-b80fe463b330"),
    ],
  },
  {
    serviceName: "The Willow Estate",
    category: "Wedding Venues",
    price: 6500,
    location: "Napa, CA",
    description:
      "The Willow Estate offers a refined outdoor setting in Napa with sweeping gardens, timeless architecture, and flexible ceremony spaces. Its experienced venue team helps couples host intimate gatherings or grand celebrations.",
    images: [
      unsplash("photo-1519167758481-83f550bb49b3"),
      unsplash("photo-1478146896981-b80fe463b330"),
      unsplash("photo-1464366400600-7168b8af9bc3"),
    ],
  },
  {
    serviceName: "Lakeside Garden Pavilion",
    category: "Wedding Venues",
    price: 4200,
    location: "Chicago, IL",
    description:
      "Lakeside Garden Pavilion combines serene waterfront views with a light-filled reception pavilion in Chicago. The venue provides adaptable layouts, scenic photo locations, and attentive event coordination.",
    images: [
      unsplash("photo-1519167758481-83f550bb49b3"),
      unsplash("photo-1478146896981-b80fe463b330"),
      unsplash("photo-1464366400600-7168b8af9bc3"),
    ],
  },
  {
    serviceName: "Bloom & Petal Florals",
    category: "Decoration & Florist",
    price: 1500,
    location: "Portland, OR",
    description:
      "Bloom & Petal Florals designs romantic, season-led florals for ceremonies and receptions in Portland. From garden-inspired bouquets to refined centerpieces, every arrangement reflects the couple's palette and personality.",
    images: [
      unsplash("photo-1507504031003-b417219a0fde"),
      unsplash("photo-1490750967868-88aa4486c946"),
      unsplash("photo-1523438097201-512ae7d59c44"),
    ],
  },
  {
    serviceName: "Enchanted Arch Decor",
    category: "Decoration & Florist",
    price: 2200,
    location: "Miami, FL",
    description:
      "Enchanted Arch Decor transforms Miami wedding spaces with lush ceremony arches, polished reception details, and cohesive styling. The team manages design, installation, and seamless finishing touches.",
    images: [
      unsplash("photo-1507504031003-b417219a0fde"),
      unsplash("photo-1490750967868-88aa4486c946"),
      unsplash("photo-1523438097201-512ae7d59c44"),
    ],
  },
  {
    serviceName: "Saffron Table Catering",
    category: "Catering Services",
    price: 3500,
    location: "Houston, TX",
    description:
      "Saffron Table Catering presents thoughtful menus for wedding celebrations across Houston, blending polished presentation with memorable flavors. Full-service planning includes tastings, dietary accommodations, and professional on-site service.",
    images: [
      unsplash("photo-1555244162-803834f70033"),
      unsplash("photo-1556911220-bff31c812dba"),
      unsplash("photo-1414235077428-338989a2e8c0"),
    ],
  },
  {
    serviceName: "Glow Studio Bridal Makeup",
    category: "Makeup & Styling",
    price: 450,
    location: "Nashville, TN",
    description:
      "Glow Studio Bridal Makeup provides long-wearing, camera-ready beauty for Nashville weddings. Personalized consultations and calm on-location service ensure each look feels polished, radiant, and completely personal.",
    images: [
      unsplash("photo-1487412912498-0447578fcca8"),
      unsplash("photo-1526045478516-99145907023c"),
      unsplash("photo-1512496015851-a90fb38ba796"),
    ],
  },
  {
    serviceName: "Velvet Hair & Makeup Co.",
    category: "Makeup & Styling",
    price: 380,
    location: "Seattle, WA",
    description:
      "Velvet Hair & Makeup Co. creates effortless bridal hair and refined makeup looks throughout Seattle. The team offers group coordination, trial planning, and detail-focused touchups for a smooth getting-ready experience.",
    images: [
      unsplash("photo-1487412912498-0447578fcca8"),
      unsplash("photo-1526045478516-99145907023c"),
      unsplash("photo-1512496015851-a90fb38ba796"),
    ],
  },
  {
    serviceName: "Atelier Rose Bridal Gowns",
    category: "Wedding Fashion",
    price: 1900,
    location: "Boston, MA",
    description:
      "Atelier Rose Bridal Gowns offers an intimate Boston boutique experience with modern and romantic gowns, expert fittings, and attentive styling. Each appointment is curated to help brides find a dress that feels beautifully distinct.",
    images: [
      unsplash("photo-1595777457583-95e059d581b8"),
      unsplash("photo-1594552072238-b8a33785b261"),
      unsplash("photo-1566174053879-31528523f8ae"),
    ],
  },
];

export async function verifyImageUrl(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*" },
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!contentType.startsWith("image/")) {
      throw new Error(`unexpected content-type ${contentType || "(missing)"}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function findVendorId(database: Db): Promise<ObjectId> {
  const users = database.collection<UserRecord>("user");
  const vendor = await users.findOne(
    { role: "vendor" },
    { projection: { _id: 1 } },
  );
  if (vendor) {
    return getUserObjectId(vendor);
  }

  const admin = await users.findOne(
    { role: "admin" },
    { projection: { _id: 1 } },
  );
  if (admin) {
    return getUserObjectId(admin);
  }

  throw new Error(
    "No existing vendor or admin user was found, so no services were written.",
  );
}

export async function seedFeaturedServices(
  database: Db,
): Promise<{ inserted: number; alreadyPresent: number }> {
  const vendorId = await findVendorId(database);
  const services = database.collection<StoredService>("services");
  let inserted = 0;
  let alreadyPresent = 0;

  for (const service of seedServices) {
    for (const imageUrl of service.images) {
      try {
        await verifyImageUrl(imageUrl);
      } catch (error) {
        throw new Error(
          `Image verification failed for ${service.serviceName}: ${imageUrl} (${error instanceof Error ? error.message : String(error)})`,
        );
      }
    }

    const now = new Date();
    const record: StoredService = {
      vendorId,
      serviceName: service.serviceName,
      category: service.category,
      description: service.description,
      price: service.price,
      location: service.location,
      images: service.images,
      status: "approved",
      isAvailable: true,
      createdAt: now,
    };

    const result = await services.updateOne(
      { serviceName: service.serviceName },
      { $set: record, $setOnInsert: { _id: new ObjectId() } },
      { upsert: true },
    );
    if (result.upsertedCount === 1) {
      inserted += 1;
    } else if (result.matchedCount === 1) {
      alreadyPresent += 1;
    }
  }

  return { inserted, alreadyPresent };
}

async function main(): Promise<void> {
  const parsed = seedEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid service seed configuration: ${details}`);
  }

  const database = await connectToDatabase(
    parsed.data.MONGODB_URI,
    parsed.data.DB_NAME,
  );
  const result = await seedFeaturedServices(database);
  console.log(
    `Services seed complete: ${result.inserted} inserted, ${result.alreadyPresent} already present.`,
  );
}

if (require.main === module) {
  void main()
    .catch((error: unknown) => {
      console.error(
        "Service seeding failed:",
        error instanceof Error ? error.message : error,
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        await closeDatabaseConnection();
      } catch (error) {
        console.error("Failed to close MongoDB connection", error);
        process.exitCode = 1;
      }
    });
}

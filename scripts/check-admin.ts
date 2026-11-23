import "dotenv/config";

type JsonRecord = Record<string, unknown>;

interface ProbeResult {
  status: number;
  body: unknown;
}

interface Probe {
  label: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: JsonRecord;
  expectedAdminStatus: number;
  validateAdminBody?: (body: unknown) => boolean;
}

function requiredEnv(name: "API_URL" | "ADMIN_TOKEN" | "VENDOR_TOKEN"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set to run check:admin`);
  }
  return value;
}

async function request(
  baseUrl: string,
  path: string,
  method: Probe["method"],
  token?: string,
  body?: JsonRecord,
): Promise<ProbeResult> {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsedBody: unknown = text;
  if (text) {
    try {
      parsedBody = JSON.parse(text) as unknown;
    } catch {
      parsedBody = text;
    }
  }
  return { status: response.status, body: parsedBody };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedRecord(value: unknown, key: string): JsonRecord | undefined {
  return isRecord(value) && isRecord(value[key]) ? value[key] : undefined;
}

function nestedArray(value: unknown, key: string): unknown[] | undefined {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] : undefined;
}

function formatStatus(status: number | null, expected: number): string {
  return status === null ? `ERROR (expected ${expected})` : `${status} (expected ${expected})`;
}

async function main(): Promise<void> {
  const baseUrl = requiredEnv("API_URL");
  const adminToken = requiredEnv("ADMIN_TOKEN");
  const vendorToken = requiredEnv("VENDOR_TOKEN");

  const rows: Array<{
    label: string;
    admin: number | null;
    vendor: number | null;
    anonymous: number | null;
    expected: [number | null, number | null, number | null];
    pass: boolean;
  }> = [];
  const record = (
    label: string,
    admin: number | null,
    vendor: number | null,
    anonymous: number | null,
    expected: [number | null, number | null, number | null],
    pass: boolean,
  ) => rows.push({ label, admin, vendor, anonymous, expected, pass });

  for (const [label, path, expected] of [
    ["Health", "/health", 200],
    ["/api/me", "/api/me", 200],
  ] as const) {
    const [adminResult, vendorResult, anonymousResult] = await Promise.all([
      request(baseUrl, path, "GET", adminToken).catch(() => null),
      request(baseUrl, path, "GET", vendorToken).catch(() => null),
      request(baseUrl, path, "GET").catch(() => null),
    ]);
    const expects = label === "Health" ? [200, 200, 200] : [200, 200, 401];
    record(
      label,
      adminResult?.status ?? null,
      vendorResult?.status ?? null,
      anonymousResult?.status ?? null,
      expects as [number, number, number],
      adminResult?.status === expects[0] &&
        vendorResult?.status === expects[1] &&
        anonymousResult?.status === expects[2],
    );
    if (label === "/api/me" && adminResult?.status === 200) {
      const adminUser = nestedRecord(adminResult.body, "user");
      if (typeof adminUser?.id !== "string" || adminUser.role !== "admin") {
        record(
          "/api/me admin identity",
          adminResult.status,
          null,
          null,
          [200, null, null],
          false,
        );
      }
    }
  }

  const adminMe = await request(baseUrl, "/api/me", "GET", adminToken).catch(() => null);
  const adminId = nestedRecord(adminMe?.body, "user")?.id;
  const serviceName = `WedPlan admin check ${new Date().toISOString()}`;
  let temporaryServiceId: string | undefined;
  let temporaryServiceCreated = false;

  const createService = await request(
    baseUrl,
    "/api/vendor/services",
    "POST",
    vendorToken,
    {
      serviceName,
      category: "Wedding Venues",
      description: "Temporary service created by the admin API verification script.",
      price: 1,
      location: "Admin API verification",
      images: [],
      isAvailable: false,
    },
  ).catch(() => null);
  const createdService = nestedRecord(createService?.body, "service");
  if (
    createService?.status === 201 &&
    typeof createdService?._id === "string" &&
    /^[a-f\d]{24}$/i.test(createdService._id)
  ) {
    temporaryServiceId = createdService._id;
    temporaryServiceCreated = true;
  }
  record(
    "Prepare temporary service for status/delete checks",
    null,
    createService?.status ?? null,
    null,
    [null, 201, null],
    temporaryServiceCreated,
  );

  const [userListResult, serviceListResult] = await Promise.all([
    request(baseUrl, "/api/admin/users?limit=1", "GET", adminToken).catch(() => null),
    request(baseUrl, "/api/admin/services?limit=1", "GET", adminToken).catch(() => null),
  ]);
  const userListValid = Array.isArray(nestedArray(userListResult?.body, "users"));
  const servicesListValid = Array.isArray(nestedArray(serviceListResult?.body, "services"));
  const adminUserId = typeof adminId === "string" ? adminId : undefined;

  const probes: Probe[] = [
    {
      label: "GET /api/admin/stats",
      method: "GET",
      path: "/api/admin/stats",
      expectedAdminStatus: 200,
      validateAdminBody: (body) => {
        const stats = nestedRecord(body, "stats");
        return (
          !!stats &&
          ["totalUsers", "totalVendors", "totalCustomers", "totalServices", "pendingServices", "totalTransactions"]
            .every((key) => typeof stats[key] === "number")
        );
      },
    },
    {
      label: "GET /api/admin/users",
      method: "GET",
      path: "/api/admin/users?q=admin&role=admin",
      expectedAdminStatus: 200,
      validateAdminBody: (body) => Array.isArray(nestedArray(body, "users")),
    },
    {
      label: "GET /api/admin/users/:id",
      method: "GET",
      path: adminUserId ? `/api/admin/users/${encodeURIComponent(adminUserId)}` : "",
      expectedAdminStatus: 200,
      validateAdminBody: (body) => !!nestedRecord(body, "user"),
    },
    {
      label: "PATCH /api/admin/users/:id/block",
      method: "PATCH",
      path: adminUserId
        ? `/api/admin/users/${encodeURIComponent(adminUserId)}/block`
        : "",
      body: { isBlocked: false },
      expectedAdminStatus: 200,
      validateAdminBody: (body) => !!nestedRecord(body, "user"),
    },
    {
      label: "Admin cannot block themselves",
      method: "PATCH",
      path: adminUserId
        ? `/api/admin/users/${encodeURIComponent(adminUserId)}/block`
        : "",
      body: { isBlocked: true },
      expectedAdminStatus: 400,
      validateAdminBody: (body) =>
        isRecord(body) && typeof body.message === "string",
    },
    {
      label: "GET /api/admin/services",
      method: "GET",
      path: "/api/admin/services?q=WedPlan",
      expectedAdminStatus: 200,
      validateAdminBody: (body) => Array.isArray(nestedArray(body, "services")),
    },
    {
      label: "PATCH /api/admin/services/:id/status",
      method: "PATCH",
      path: temporaryServiceId
        ? `/api/admin/services/${temporaryServiceId}/status`
        : "",
      body: { status: "pending" },
      expectedAdminStatus: 200,
      validateAdminBody: (body) => !!nestedRecord(body, "service"),
    },
    {
      label: "DELETE /api/admin/services/:id",
      method: "DELETE",
      path: temporaryServiceId ? `/api/admin/services/${temporaryServiceId}` : "",
      expectedAdminStatus: 200,
      validateAdminBody: (body) => isRecord(body) && body.message === "Service deleted",
    },
    {
      label: "GET /api/admin/transactions",
      method: "GET",
      path: "/api/admin/transactions",
      expectedAdminStatus: 200,
      validateAdminBody: (body) => Array.isArray(nestedArray(body, "transactions")),
    },
  ];

  for (const probe of probes) {
    const pathAvailable =
      probe.path.length > 0 &&
      (probe.label !== "PATCH /api/admin/services/:id/status" &&
        probe.label !== "DELETE /api/admin/services/:id" ||
        temporaryServiceCreated);
    if (!pathAvailable) {
      record(probe.label, null, null, null, [200, 403, 401], false);
      continue;
    }

    let adminResult: ProbeResult | null;
    let vendorResult: ProbeResult | null;
    let anonymousResult: ProbeResult | null;
    if (probe.method === "DELETE") {
      vendorResult = await request(
        baseUrl,
        probe.path,
        probe.method,
        vendorToken,
        probe.body,
      ).catch(() => null);
      anonymousResult = await request(
        baseUrl,
        probe.path,
        probe.method,
        undefined,
        probe.body,
      ).catch(() => null);
      adminResult = await request(
        baseUrl,
        probe.path,
        probe.method,
        adminToken,
        probe.body,
      ).catch(() => null);
    } else {
      [adminResult, vendorResult, anonymousResult] = await Promise.all([
        request(baseUrl, probe.path, probe.method, adminToken, probe.body).catch(() => null),
        request(baseUrl, probe.path, probe.method, vendorToken, probe.body).catch(() => null),
        request(baseUrl, probe.path, probe.method, undefined, probe.body).catch(() => null),
      ]);
    }
    const adminPass =
      adminResult?.status === probe.expectedAdminStatus &&
      (probe.validateAdminBody?.(adminResult.body) ?? true);
    record(
      probe.label,
      adminResult?.status ?? null,
      vendorResult?.status ?? null,
      anonymousResult?.status ?? null,
      [probe.expectedAdminStatus, 403, 401],
      adminPass && vendorResult?.status === 403 && anonymousResult?.status === 401,
    );
  }

  if (temporaryServiceId) {
    const cleanup = await request(
      baseUrl,
      `/api/vendor/services/${temporaryServiceId}`,
      "DELETE",
      vendorToken,
    ).catch(() => null);
    if (cleanup && cleanup.status !== 204 && cleanup.status !== 404) {
      record("Temporary service cleanup", cleanup.status, null, null, [204, null, null], false);
    }
  }

  if (!userListValid || !servicesListValid) {
    record(
      "Admin list JSON shape",
      userListResult?.status ?? null,
      null,
      null,
      [200, null, null],
      false,
    );
  }

  console.log("Admin API verification");
  console.log(
    "CHECK".padEnd(44),
    "ADMIN".padEnd(17),
    "VENDOR".padEnd(17),
    "NO TOKEN".padEnd(17),
    "RESULT",
  );
  for (const row of rows) {
    const outcome = row.pass ? "PASS" : "FAIL";
    const formatColumn = (status: number | null, expected: number | null) =>
      expected === null ? (status === null ? "—" : `${status} (unexpected)`) : formatStatus(status, expected);
    console.log(
      row.label.padEnd(44),
      formatColumn(row.admin, row.expected[0]).padEnd(17),
      formatColumn(row.vendor, row.expected[1]).padEnd(17),
      formatColumn(row.anonymous, row.expected[2]).padEnd(17),
      outcome,
    );
  }

  if (rows.some((row) => !row.pass)) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(
    "Admin API verification could not start:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
});

import { AppError } from "./errors";

export function isAllowedCorsOrigin(
  origin: string | undefined,
  clientUrl: string | undefined,
  nodeEnvironment: string | undefined,
): boolean {
  const normalizedClientUrl = clientUrl?.replace(/\/+$/, "");

  return (
    (origin !== undefined &&
      normalizedClientUrl !== undefined &&
      origin === normalizedClientUrl) ||
    (nodeEnvironment === "development" && origin === "http://localhost:3000")
  );
}

export function createCorsOptions(
  clientUrl: string | undefined,
  nodeEnvironment: string | undefined,
) {
  return {
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) {
      if (isAllowedCorsOrigin(origin, clientUrl, nodeEnvironment)) {
        callback(null, true);
        return;
      }

      if (!origin) {
        callback(null, false);
        return;
      }

      callback(new AppError(403, "Origin not allowed"));
    },
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204,
  };
}

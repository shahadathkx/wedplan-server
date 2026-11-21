import { AppError } from "./errors";

export function isAllowedCorsOrigin(
  origin: string | undefined,
  clientUrl: string,
  nodeEnvironment: string | undefined,
): boolean {
  return (
    origin === clientUrl ||
    (nodeEnvironment === "development" && origin === "http://localhost:3000")
  );
}

export function createCorsOptions(clientUrl: string, nodeEnvironment: string | undefined) {
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
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  };
}

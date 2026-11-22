import { app } from "./app";
import { getDatabaseConfig, getPort } from "./lib/env";
import { closeDatabaseConnection, connectToDatabase } from "./lib/mongodb";

async function startServer(): Promise<void> {
  const { uri, databaseName } = getDatabaseConfig();
  await connectToDatabase(uri, databaseName);
  const port = getPort();
  const server = app.listen(port, () => {
    console.log(`WedPlan API listening on port ${port}`);
  });

  const shutdown = (): void => {
    server.close((error) => {
      if (error) {
        console.error("Failed to close HTTP server cleanly", error);
        process.exitCode = 1;
      }

      void closeDatabaseConnection().catch((closeError: unknown) => {
        console.error("Failed to close MongoDB connection", closeError);
        process.exitCode = 1;
      });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error: unknown) => {
  console.error("Failed to start WedPlan API", error);
  process.exitCode = 1;
});

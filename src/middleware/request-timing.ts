import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import type { Request, RequestHandler } from "express";

interface RequestTiming {
  startedAt: number;
  middlewareMs: number | null;
  handlerMs: number;
  databaseCommandMs: number;
  databaseConnectMs: number;
}

interface PendingDatabaseCommand {
  timing: RequestTiming;
  startedAt: number;
}

interface CommandEvent {
  requestId: number;
  connectionId: unknown;
}

const requestTimingStorage = new AsyncLocalStorage<RequestTiming>();
const requestTimings = new WeakMap<Request, RequestTiming>();
const pendingDatabaseCommands = new Map<string, PendingDatabaseCommand>();
let slowestEndpoint: { endpoint: string; totalMs: number } | undefined;

function commandKey(event: CommandEvent): string {
  return `${String(event.connectionId)}:${event.requestId}`;
}

export function recordDatabaseCommandStarted(event: CommandEvent): void {
  const timing = requestTimingStorage.getStore();
  if (!timing) {
    return;
  }

  pendingDatabaseCommands.set(commandKey(event), {
    timing,
    startedAt: performance.now(),
  });
}

export function recordDatabaseCommandFinished(event: CommandEvent): void {
  const key = commandKey(event);
  const pending = pendingDatabaseCommands.get(key);
  if (!pending) {
    return;
  }

  pendingDatabaseCommands.delete(key);
  pending.timing.databaseCommandMs += performance.now() - pending.startedAt;
}

export function recordDatabaseCommandFailed(event: CommandEvent): void {
  recordDatabaseCommandFinished(event);
}

export function recordDatabaseConnection(durationMs: number): void {
  const timing = requestTimingStorage.getStore();
  if (timing) {
    timing.databaseConnectMs += durationMs;
  }
}

export const requestTimingMiddleware: RequestHandler = (request, response, next) => {
  const timing: RequestTiming = {
    startedAt: performance.now(),
    middlewareMs: null,
    handlerMs: 0,
    databaseCommandMs: 0,
    databaseConnectMs: 0,
  };
  requestTimings.set(request, timing);

  response.once("finish", () => {
    const totalMs = performance.now() - timing.startedAt;
    const middlewareMs = timing.middlewareMs ?? Math.max(0, totalMs - timing.handlerMs);
    const routePath = request.route?.path;
    const endpointPath =
      typeof routePath === "string"
        ? `${request.baseUrl}${routePath}`
        : request.path;
    const endpoint = `${request.method} ${endpointPath}`;
    const isSlowest = !slowestEndpoint || totalMs > slowestEndpoint.totalMs;
    if (isSlowest) {
      slowestEndpoint = { endpoint, totalMs };
    }
    const slowest = slowestEndpoint ?? { endpoint, totalMs };

    console.info("[request-timing]", {
      endpoint,
      status: response.statusCode,
      middlewareMs: Number(middlewareMs.toFixed(2)),
      databaseMs: Number(timing.databaseCommandMs.toFixed(2)),
      databaseConnectMs: Number(timing.databaseConnectMs.toFixed(2)),
      handlerMs: Number(timing.handlerMs.toFixed(2)),
      totalMs: Number(totalMs.toFixed(2)),
      slowestEndpoint: slowest.endpoint,
      slowestTotalMs: Number(slowest.totalMs.toFixed(2)),
    });

    if (isSlowest) {
      console.info(
        "[request-timing] slowest endpoint observed in this instance",
        {
          endpoint: slowest.endpoint,
          totalMs: Number(slowest.totalMs.toFixed(2)),
        },
      );
    }
  });

  requestTimingStorage.run(timing, next);
};

export function timeRequestHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    const timing = requestTimings.get(request);
    const startedAt = performance.now();
    if (timing && timing.middlewareMs === null) {
      timing.middlewareMs = startedAt - timing.startedAt;
    }

    const recordHandlerTime = (): void => {
      if (timing) {
        timing.handlerMs += performance.now() - startedAt;
      }
    };

    try {
      const result = handler(request, response, next);
      if (result && typeof result === "object" && "then" in result) {
        return Promise.resolve(result).finally(recordHandlerTime);
      }
      recordHandlerTime();
      return result;
    } catch (error) {
      recordHandlerTime();
      next(error);
    }
  };
}

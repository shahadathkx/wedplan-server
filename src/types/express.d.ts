import type { UserRecord } from "../lib/users";

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

export {};

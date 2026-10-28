import type { AuthenticatedSession } from "../auth/session";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedSession;
    }
  }
}

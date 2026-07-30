import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 doesn't catch a promise rejection thrown from an async route
// handler — it becomes an unhandled rejection, which crashes the entire
// Node process (see the ingest-route gotcha in HANDOFF.md, which had this
// exact bug once already). Wrap every async handler with this so a failure
// reaches the error-handling middleware in app.ts instead of taking the
// whole server down over one request's transient failure.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

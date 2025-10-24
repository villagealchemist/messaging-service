import express from 'express';
import { RegisterRoutes } from '../src/routes';
import { requestLoggerMiddleware } from '../src/middleware/requestLogger';

/**
 * Creates a properly configured Express app for testing.
 * Matches the production app setup from server.ts.
 */
export function createTestApp(): express.Application {
  const app = express();

  // Parse JSON request bodies
  app.use(express.json());

  // Attach request ID and logger to each request (required by controllers)
  app.use(requestLoggerMiddleware);

  // Mount TSOA routes
  RegisterRoutes(app);

  // Global error handler - matches TSOA error format
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log('[ERROR HANDLER] Received error:', {
      message: err.message,
      code: err.code,
      status: err.status,
      details: err.details,
      resStatusCode: res.statusCode
    });

    // Check if response already has status set by controller
    const status = res.statusCode !== 200 ? res.statusCode : (err.status || 500);

    const responseBody: any = {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR',
    };

    // Include details (fields for ValidationError) if present
    if (err.details) {
      responseBody.details = err.details;
    }

    res.status(status).json(responseBody);
  });

  return app;
}

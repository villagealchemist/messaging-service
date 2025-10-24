import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createRequestLogger, logger } from '../utils/logger';

/**
 * Extend Express Request interface to include request ID and child logger.
 * These fields are populated by requestIdMiddleware and available in all handlers.
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Unique request identifier (UUIDv4).
       * Can be provided via X-Request-ID header or auto-generated.
       */
      id: string;

      /**
       * Child logger with request ID context.
       * All logs automatically include requestId for tracing.
       */
      logger: typeof logger;
    }
  }
}

/**
 * Middleware that attaches a unique request ID and child logger to each incoming request.
 *
 * Request ID generation:
 * - If X-Request-ID header is provided, use it
 * - Otherwise, generate a new UUIDv4
 *
 * Logger creation:
 * - Creates a child logger using createRequestLogger()
 * - All logs via req.logger automatically include requestId context
 * - Enables end-to-end request tracing across the application
 *
 * @param req - Express request object
 * @param res - Express response object (with X-Request-ID header set)
 * @param next - Express next function
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use provided request ID from header, or generate new one
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  // Attach request ID to request object
  req.id = requestId;

  // Create child logger with request ID context
  req.logger = createRequestLogger(requestId);

  // Add request ID to response headers for client-side tracing
  res.setHeader('X-Request-ID', requestId);

  // Log initialization at debug level
  req.logger.debug('Request logger initialized', { requestId });

  next();
}

/**
 * Default export for convenience
 */
export default requestLoggerMiddleware;

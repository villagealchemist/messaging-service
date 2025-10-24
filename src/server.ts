import express from 'express';
import { logger } from './utils/logger';
import { RegisterRoutes } from './routes';
import { requestLoggerMiddleware } from './middleware/requestLogger';

const app = express();
const PORT = process.env.PORT || 8080;

// Parse JSON request bodies
app.use(express.json());

// Attach request ID and logger to each request
app.use(requestLoggerMiddleware);

// Add a health endpoint for good measure
app.get('/health', (_, res) => res.json({ status: 'healthy' }));

// Mount TSOA routes
RegisterRoutes(app);

// Global error handler for safety
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', { path: req.path, error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        code: err.code || 'INTERNAL_ERROR',
    });
});

app.listen(PORT, () => {
    console.log(`Messaging service listening on port ${PORT}`);
});

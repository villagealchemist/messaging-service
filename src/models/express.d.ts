import 'express';
import type { AppLogger } from '../utils/logger';

declare global {
    namespace Express {
        export interface Request {
            logger: AppLogger;
            requestId: string;
        }
    }
}


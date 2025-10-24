import winston from 'winston';
import path from 'path';
import fs from 'fs';

const nodeEnv = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug');

/**
 * Shared timestamp format
 */
const timestampFormat = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });

/**
 * Clean, human-readable development formatter.
 * - No color
 * - Includes timestamp, level, requestId, message, and meta
 */
const plainTextFormat = winston.format.combine(
    timestampFormat,
    winston.format.printf((info) => {
        const { timestamp, level, message, requestId, source, ...meta } = info;
        let logLine = `${timestamp} [${level}]`;

        if (requestId) logLine += ` [${requestId}]`;
        logLine += ` ${message}`;
        if (source) logLine += ` (${source})`;

        const metaKeys = Object.keys(meta);
        if (metaKeys.length > 0) {
            logLine += `\n${JSON.stringify(meta, null, 2)}`;
        }

        return logLine;
    })
);

/**
 * Structured JSON format for production / machine parsing.
 */
const jsonFormat = winston.format.combine(
    timestampFormat,
    winston.format.errors({ stack: true }),
    winston.format.json()
);

/**
 * Core logger instance.
 */
export const logger = winston.createLogger({
    level: logLevel,
    format: nodeEnv === 'production' ? jsonFormat : plainTextFormat,
    transports: [new winston.transports.Console()],
    exitOnError: false,
});

/**
 * Child logger with request context.
 */
export const createRequestLogger = (requestId: string): winston.Logger => {
    return logger.child({ requestId });
};

/**
 * File transports (production only)
 */
if (nodeEnv === 'production') {
    try {
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

        logger.add(
            new winston.transports.File({
                filename: path.join(logsDir, 'error.log'),
                level: 'error',
                maxsize: 5 * 1024 * 1024,
                maxFiles: 5,
                format: jsonFormat,
            })
        );

        logger.add(
            new winston.transports.File({
                filename: path.join(logsDir, 'combined.log'),
                maxsize: 5 * 1024 * 1024,
                maxFiles: 5,
                format: jsonFormat,
            })
        );

        logger.info('File logging enabled', { logsDir });
    } catch (error) {
        logger.error('Failed to initialize file logging', { error });
    }
}

/**
 * Startup log confirmation.
 */
logger.info('Logger initialized', {
    environment: nodeEnv,
    level: logLevel,
    format: nodeEnv === 'production' ? 'json' : 'plain',
});

export type AppLogger = typeof logger;
export default logger;

import dotenv from 'dotenv';
import { logger } from './logger';

// Load environment variables
dotenv.config();

/**
 * Configuration object with validated environment variables
 */
export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'messaging_service',
    user: process.env.DB_USER || 'messaging_user',
    password: process.env.DB_PASSWORD || 'messaging_password',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },

  // Providers
  providers: {
    smsUrl: process.env.SMS_PROVIDER_URL || 'http://localhost:8081/sms',
    emailUrl: process.env.EMAIL_PROVIDER_URL || 'http://localhost:8081/email',
  },

  // Retry configuration
  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    delayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
    maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '10000', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

/**
 * Validates configuration on startup
 * Note: Uses console for errors since logger depends on config
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (config.database.poolMin > config.database.poolMax) {
    errors.push('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  }

  if (config.retry.maxRetries < 0) {
    errors.push('MAX_RETRIES must be non-negative');
  }

  if (config.retry.delayMs < 0) {
    errors.push('RETRY_DELAY_MS must be non-negative');
  }

  if (config.retry.maxDelayMs < config.retry.delayMs) {
    errors.push('RETRY_MAX_DELAY_MS must be greater than or equal to RETRY_DELAY_MS');
  }

  if (errors.length > 0) {
    logger.error('Configuration validation failed', { errors });
    process.exit(1);
  }

  logger.info('Configuration validated successfully');
}

export default config;

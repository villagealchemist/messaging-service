import { Controller, Get, Route, Tags, Response, SuccessResponse, Request } from 'tsoa';
import { Request as ExpressRequest } from 'express';
import { HealthCheckResponse, ApiError } from '../models';
import { getDatabaseHealth } from '../database/connection';

/**
 * Controller for health check endpoints.
 * Thin layer that delegates to database connection check.
 */
@Route('health')
@Tags('Health')
export class HealthController extends Controller {
  /**
   * Checks the overall health of the service.
   * Includes database connectivity and latency metrics.
   */
  @Get()
  @SuccessResponse(200, 'Service is healthy')
  @Response<ApiError>(503, 'Service Unavailable')
  public async checkHealth(): Promise<HealthCheckResponse> {
    const databaseHealth = await getDatabaseHealth();
    const isHealthy = databaseHealth.connected;

    const response: HealthCheckResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: databaseHealth,
    };

    if (!isHealthy) {
      this.setStatus(503);
    }

    return response;
  }
}

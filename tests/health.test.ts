import request from 'supertest';
import { createTestApp } from './testApp';
import './setup';

const app = createTestApp();

describe('Health Endpoint', () => {
  it('should return healthy status with database metrics', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      database: {
        connected: true,
        latencyMs: expect.any(Number),
      },
    });
  });

  it('should have low database latency', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.database.latencyMs).toBeLessThan(100);
  });
});

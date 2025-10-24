import request from 'supertest';
import { createTestApp } from './testApp';
import { resetDatabase } from './setup';
import './setup';

const app = createTestApp();

describe('SMS/MMS Message Endpoints', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/messages/sms - Send SMS', () => {
    it('should send SMS message and create conversation', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025551234',
          to: '+12025555678',
          type: 'sms',
          body: 'Hello from integration test',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        conversationId: expect.any(String),
        providerType: 'sms',
        messageType: 'sms',
        direction: 'outbound',
        from: '+12025551234',
        to: '+12025555678',
        body: 'Hello from integration test',
        status: 'pending',
      });
    });

    it('should normalize phone numbers to E.164 format', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '(202) 555-1234',
          to: '202-555-5678',
          type: 'sms',
          body: 'Testing normalization',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('+12025551234');
      expect(response.body.to).toBe('+12025555678');
    });

    it('should reject invalid phone numbers', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: 'invalid-phone',
          to: '+12025555678',
          type: 'sms',
          body: 'This should fail',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025551234',
          type: 'sms',
          // Missing 'to' and 'body'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/messages/sms - Send MMS', () => {
    it('should send MMS message with attachments', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025551234',
          to: '+12025555678',
          type: 'mms',
          body: 'Check out this image',
          attachments: ['https://example.com/image.jpg'],
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        messageType: 'mms',
        attachments: ['https://example.com/image.jpg'],
      });
    });

    it('should allow MMS with no body text', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025551234',
          to: '+12025555678',
          type: 'mms',
          body: '',
          attachments: ['https://example.com/image.jpg'],
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/webhooks/sms - Receive Inbound SMS', () => {
    it('should receive inbound SMS and create conversation', async () => {
      const response = await request(app)
        .post('/api/webhooks/sms')
        .send({
          from: '+12025555678',
          to: '+12025551234',
          type: 'sms',
          body: 'Inbound message test',
          attachments: null,
          timestamp: new Date().toISOString(),
          providerMessageId: 'provider-msg-12345',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        direction: 'inbound',
        from: '+12025555678',
        to: '+12025551234',
        body: 'Inbound message test',
      });
    });

    it('should deduplicate messages with same provider ID', async () => {
      const payload = {
        from: '+12025555678',
        to: '+12025551234',
        type: 'sms',
        body: 'Duplicate test',
        attachments: null,
        timestamp: new Date().toISOString(),
        providerMessageId: 'duplicate-id-123',
      };

      const first = await request(app).post('/api/webhooks/sms').send(payload);
      const second = await request(app).post('/api/webhooks/sms').send(payload);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.id).toBe(second.body.id);
    });
  });
});

describe('Email Message Endpoints', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/messages/email - Send Email', () => {
    it('should send email message and create conversation', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: 'Integration Test Email',
          body: 'This is a test email body',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        providerType: 'email',
        messageType: 'email',
        direction: 'outbound',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        body: 'This is a test email body',
        status: 'pending',
      });
    });

    it('should normalize email addresses to lowercase', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'SENDER@EXAMPLE.COM',
          to: 'RecipienT@Example.COM',
          subject: 'Case test',
          body: 'Testing case normalization',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('sender@example.com');
      expect(response.body.to).toBe('recipient@example.com');
    });

    it('should strip Gmail aliases', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'user+alias@gmail.com',
          to: 'recipient@example.com',
          subject: 'Alias test',
          body: 'Testing Gmail alias stripping',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('user@gmail.com');
    });

    it('should reject invalid email addresses', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'invalid-email',
          to: 'recipient@example.com',
          subject: 'Should fail',
          body: 'This should not work',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it('should send email with attachments', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: 'Email with attachments',
          body: 'Please see attached files',
          attachments: [
            'https://example.com/document.pdf',
            'https://example.com/image.png',
          ],
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.attachments).toEqual([
        'https://example.com/document.pdf',
        'https://example.com/image.png',
      ]);
    });
  });

  describe('POST /api/webhooks/email - Receive Inbound Email', () => {
    it('should receive inbound email', async () => {
      const response = await request(app)
        .post('/api/webhooks/email')
        .send({
          from: 'external@example.com',
          to: 'support@mycompany.com',
          subject: 'Customer inquiry',
          body: 'I have a question about your service',
          attachments: null,
          timestamp: new Date().toISOString(),
          providerMessageId: 'email-provider-123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        direction: 'inbound',
        from: 'external@example.com',
        to: 'support@mycompany.com',
      });
    });
  });
});

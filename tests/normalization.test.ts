import request from 'supertest';
import { createTestApp } from './testApp';
import { resetDatabase } from './setup';
import './setup';

const app = createTestApp();

describe('Contact Normalization Edge Cases', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Phone Number Normalization', () => {
    it('should normalize US phone with country code', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+1 (202) 555-1234',
          to: '+1-202-555-5678',
          type: 'sms',
          body: 'Test',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('+12025551234');
      expect(response.body.to).toBe('+12025555678');
    });

    it('should normalize phone without country code (assume US)', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '2025551234',
          to: '(202) 555-5678',
          type: 'sms',
          body: 'Test',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('+12025551234');
      expect(response.body.to).toBe('+12025555678');
    });

    it('should normalize phone with dots as separators', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '202.555.1234',
          to: '+1.202.555.5678',
          type: 'sms',
          body: 'Test',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('+12025551234');
      expect(response.body.to).toBe('+12025555678');
    });

    it('should normalize international phone numbers', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+44 20 7946 0958',
          to: '+33 1 42 86 82 00',
          type: 'sms',
          body: 'International test',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('+442079460958');
      expect(response.body.to).toBe('+33142868200');
    });

    it('should reject obviously invalid phone numbers', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '123',
          to: '+12025555678',
          type: 'sms',
          body: 'Should fail',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-numeric phone input', async () => {
      const response = await request(app)
        .post('/api/messages/sms')
        .send({
          from: 'not-a-phone-number',
          to: '+12025555678',
          type: 'sms',
          body: 'Should fail',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Email Address Normalization', () => {
    it('should normalize email to lowercase', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'ALICE@EXAMPLE.COM',
          to: 'Bob@Example.Com',
          subject: 'Test',
          body: 'Lowercase test',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('alice@example.com');
      expect(response.body.to).toBe('bob@example.com');
    });

    it('should strip Gmail plus aliases', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'user+shopping@gmail.com',
          to: 'recipient+work@gmail.com',
          subject: 'Alias test',
          body: 'Testing Gmail aliases',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('user@gmail.com');
      expect(response.body.to).toBe('recipient@gmail.com');
    });

    it('should strip Gmail dot variations', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'first.last@gmail.com',
          to: 'f.i.r.s.t.l.a.s.t@gmail.com',
          subject: 'Dot test',
          body: 'Testing Gmail dots',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('firstlast@gmail.com');
      expect(response.body.to).toBe('firstlast@gmail.com');
    });

    it('should NOT strip aliases from non-Gmail addresses', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'user+alias@outlook.com',
          to: 'recipient+tag@yahoo.com',
          subject: 'Non-Gmail alias',
          body: 'Should preserve aliases',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.from).toBe('user+alias@outlook.com');
      expect(response.body.to).toBe('recipient+tag@yahoo.com');
    });

    it('should reject emails without @ symbol', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'notanemail',
          to: 'recipient@example.com',
          subject: 'Should fail',
          body: 'Invalid email',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it('should reject emails without domain', async () => {
      const response = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'user@',
          to: 'recipient@example.com',
          subject: 'Should fail',
          body: 'Invalid email',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Cross-Format Conversation Grouping', () => {
    it('should group phone numbers regardless of format variations', async () => {
      const formats = [
        '+12025551234',
        '(202) 555-1234',
        '202-555-1234',
        '202.555.1234',
        '2025551234',
      ];

      const conversationIds: string[] = [];

      for (const format of formats) {
        const response = await request(app)
          .post('/api/messages/sms')
          .send({
            from: format,
            to: '+12025555678',
            type: 'sms',
            body: `Message from ${format}`,
            attachments: null,
            timestamp: new Date().toISOString(),
          });

        conversationIds.push(response.body.conversationId);
      }

      // All should have same conversation ID
      const uniqueIds = new Set(conversationIds);
      expect(uniqueIds.size).toBe(1);
    });

    it('should group emails regardless of case and Gmail aliases', async () => {
      const variations = [
        'user@gmail.com',
        'User@Gmail.com',
        'user+alias1@gmail.com',
        'USER+alias2@GMAIL.COM',
        'u.s.e.r@gmail.com',
      ];

      const conversationIds: string[] = [];

      for (const variation of variations) {
        const response = await request(app)
          .post('/api/messages/email')
          .send({
            from: variation,
            to: 'other@example.com',
            subject: 'Test',
            body: `Message from ${variation}`,
            attachments: null,
            timestamp: new Date().toISOString(),
          });

        conversationIds.push(response.body.conversationId);
      }

      // All should have same conversation ID
      const uniqueIds = new Set(conversationIds);
      expect(uniqueIds.size).toBe(1);
    });

    it('should maintain separate conversations for different people', async () => {
      const person1 = await request(app).post('/api/messages/sms').send({
        from: '+12025551111',
        to: '+12025559999',
        type: 'sms',
        body: 'Person 1',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      const person2 = await request(app).post('/api/messages/sms').send({
        from: '+12025552222',
        to: '+12025559999',
        type: 'sms',
        body: 'Person 2',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      expect(person1.body.conversationId).not.toBe(person2.body.conversationId);
    });
  });

  describe('Provider Separation', () => {
    it('should keep SMS and email separate even with similar identifiers', async () => {
      const sms = await request(app).post('/api/messages/sms').send({
        from: '+12025551234',
        to: '+12025555678',
        type: 'sms',
        body: 'SMS message',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      const email = await request(app).post('/api/messages/email').send({
        from: 'alice@example.com',
        to: 'bob@example.com',
        subject: 'Email message',
        body: 'Email body',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      expect(sms.body.conversationId).not.toBe(email.body.conversationId);
    });
  });
});

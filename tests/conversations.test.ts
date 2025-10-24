import request from 'supertest';
import { createTestApp } from './testApp';
import { resetDatabase } from './setup';
import './setup';

const app = createTestApp();

describe('Conversation Endpoints', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Conversation Threading', () => {
    it('should group bidirectional messages in same conversation (A→B = B→A)', async () => {
      // Send message from A to B
      const message1 = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025551234',
          to: '+12025555678',
          type: 'sms',
          body: 'Message from A to B',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      // Send message from B to A
      const message2 = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025555678',
          to: '+12025551234',
          type: 'sms',
          body: 'Reply from B to A',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(message1.status).toBe(201);
      expect(message2.status).toBe(201);
      expect(message1.body.conversationId).toBe(message2.body.conversationId);
    });

    it('should group messages regardless of phone number format', async () => {
      // Send with formatted phone
      const message1 = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '(202) 555-1234',
          to: '+12025555678',
          type: 'sms',
          body: 'First message',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      // Send with E.164 format
      const message2 = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025551234',
          to: '202-555-5678',
          type: 'sms',
          body: 'Second message',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(message1.body.conversationId).toBe(message2.body.conversationId);
    });

    it('should group emails with same participants', async () => {
      const email1 = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'alice@example.com',
          to: 'bob@example.com',
          subject: 'First email',
          body: 'Hello Bob',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      const email2 = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'bob@example.com',
          to: 'alice@example.com',
          subject: 'Re: First email',
          body: 'Hello Alice',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(email1.body.conversationId).toBe(email2.body.conversationId);
    });

    it('should group emails with Gmail aliases', async () => {
      const email1 = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'user+work@gmail.com',
          to: 'other@example.com',
          subject: 'From work alias',
          body: 'Message 1',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      const email2 = await request(app)
        .post('/api/messages/email')
        .send({
          from: 'user+personal@gmail.com',
          to: 'other@example.com',
          subject: 'From personal alias',
          body: 'Message 2',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(email1.body.conversationId).toBe(email2.body.conversationId);
    });

    it('should NOT group cross-provider conversations', async () => {
      const sms = await request(app)
        .post('/api/messages/sms')
        .send({
          from: '+12025551234',
          to: '+12025555678',
          type: 'sms',
          body: 'SMS message',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      // Different provider even if same "phone" as email
      const email = await request(app)
        .post('/api/messages/email')
        .send({
          from: '2025551234@example.com',
          to: '2025555678@example.com',
          subject: 'Email message',
          body: 'Email body',
          attachments: null,
          timestamp: new Date().toISOString(),
        });

      expect(sms.body.conversationId).not.toBe(email.body.conversationId);
    });
  });

  describe('GET /api/conversations - List Conversations', () => {
    it('should list conversations with pagination', async () => {
      // Create multiple conversations
      await request(app).post('/api/messages/sms').send({
        from: '+12025551111',
        to: '+12025552222',
        type: 'sms',
        body: 'Conversation 1',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      await request(app).post('/api/messages/sms').send({
        from: '+12025553333',
        to: '+12025554444',
        type: 'sms',
        body: 'Conversation 2',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      const response = await request(app).get('/api/conversations?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        limit: 10,
        offset: 0,
        total: 2,
      });
    });

    it('should return conversations sorted by most recent message', async () => {
      const conv1 = await request(app).post('/api/messages/sms').send({
        from: '+12025551111',
        to: '+12025552222',
        type: 'sms',
        body: 'First conversation',
        attachments: null,
        timestamp: '2025-10-24T10:00:00Z',
      });

      const conv2 = await request(app).post('/api/messages/sms').send({
        from: '+12025553333',
        to: '+12025554444',
        type: 'sms',
        body: 'Second conversation (newer)',
        attachments: null,
        timestamp: '2025-10-24T11:00:00Z',
      });

      const response = await request(app).get('/api/conversations');

      expect(response.status).toBe(200);
      expect(response.body.conversations[0].id).toBe(conv2.body.conversationId);
      expect(response.body.conversations[1].id).toBe(conv1.body.conversationId);
    });

    it('should support pagination with limit and offset', async () => {
      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/messages/sms').send({
          from: `+1202555${i.toString().padStart(4, '0')}`,
          to: '+12025559999',
          type: 'sms',
          body: `Message ${i}`,
          attachments: null,
          timestamp: new Date().toISOString(),
        });
      }

      const page1 = await request(app).get('/api/conversations?limit=2&offset=0');
      const page2 = await request(app).get('/api/conversations?limit=2&offset=2');

      expect(page1.body.conversations).toHaveLength(2);
      expect(page2.body.conversations).toHaveLength(2);
      expect(page1.body.conversations[0].id).not.toBe(
        page2.body.conversations[0].id
      );
    });
  });

  describe('GET /api/conversations/:id/metadata - Get Conversation Details', () => {
    it('should return conversation metadata with participants', async () => {
      const message = await request(app).post('/api/messages/sms').send({
        from: '+12025551234',
        to: '+12025555678',
        type: 'sms',
        body: 'Test message',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      const conversationId = message.body.conversationId;
      const response = await request(app).get(
        `/api/conversations/${conversationId}/metadata`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: conversationId,
        participants: expect.arrayContaining(['+12025551234', '+12025555678']),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        lastMessageAt: expect.any(String),
      });
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app).get(
        '/api/conversations/00000000-0000-0000-0000-000000000000/metadata'
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/conversations/:id/messages - Get Message History', () => {
    it('should return all messages in conversation', async () => {
      // Create a conversation with multiple messages
      const msg1 = await request(app).post('/api/messages/sms').send({
        from: '+12025551234',
        to: '+12025555678',
        type: 'sms',
        body: 'First message',
        attachments: null,
        timestamp: '2025-10-24T10:00:00Z',
      });

      const conversationId = msg1.body.conversationId;

      await request(app).post('/api/messages/sms').send({
        from: '+12025555678',
        to: '+12025551234',
        type: 'sms',
        body: 'Second message',
        attachments: null,
        timestamp: '2025-10-24T10:01:00Z',
      });

      await request(app).post('/api/messages/sms').send({
        from: '+12025551234',
        to: '+12025555678',
        type: 'sms',
        body: 'Third message',
        attachments: null,
        timestamp: '2025-10-24T10:02:00Z',
      });

      const response = await request(app).get(
        `/api/conversations/${conversationId}/messages`
      );

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(3);
      expect(response.body.messages[0].body).toBe('First message');
      expect(response.body.messages[2].body).toBe('Third message');
    });

    it('should support pagination for message history', async () => {
      // Create conversation with many messages
      const msg1 = await request(app).post('/api/messages/sms').send({
        from: '+12025551234',
        to: '+12025555678',
        type: 'sms',
        body: 'Message 1',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      const conversationId = msg1.body.conversationId;

      for (let i = 2; i <= 5; i++) {
        await request(app).post('/api/messages/sms').send({
          from: '+12025551234',
          to: '+12025555678',
          type: 'sms',
          body: `Message ${i}`,
          attachments: null,
          timestamp: new Date().toISOString(),
        });
      }

      const response = await request(app).get(
        `/api/conversations/${conversationId}/messages?limit=2&offset=0`
      );

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.pagination.total).toBe(5);
    });
  });

  describe('DELETE /api/conversations/:id - Delete Conversation', () => {
    it('should delete conversation and all messages', async () => {
      // Create conversation
      const message = await request(app).post('/api/messages/sms').send({
        from: '+12025551234',
        to: '+12025555678',
        type: 'sms',
        body: 'To be deleted',
        attachments: null,
        timestamp: new Date().toISOString(),
      });

      const conversationId = message.body.conversationId;

      // Delete it
      const deleteResponse = await request(app).delete(
        `/api/conversations/${conversationId}`
      );

      expect(deleteResponse.status).toBe(200);

      // Verify it's gone
      const getResponse = await request(app).get(
        `/api/conversations/${conversationId}/metadata`
      );

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent conversation', async () => {
      const response = await request(app).delete(
        '/api/conversations/00000000-0000-0000-0000-000000000000'
      );

      expect(response.status).toBe(404);
    });
  });
});

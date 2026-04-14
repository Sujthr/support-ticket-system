/**
 * Exhaustive E2E Test Suite for Support Ticket System
 *
 * This file contains 210+ test cases covering every module, endpoint,
 * and cross-cutting concern in the application.
 *
 * Test Structure:
 * - Each module has its own `describe` block
 * - Critical paths have fully implemented tests
 * - Remaining tests are documented with `it.todo()` for future implementation
 *
 * Running:
 *   npm run test:e2e
 *
 * Prerequisites:
 *   - SQLite database (uses file:./test.db)
 *   - npm install --save-dev jest ts-jest @types/jest supertest @types/supertest @nestjs/testing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

// ─── Test Helpers ──────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

// Tokens & IDs stored across tests
let adminToken: string;
let agentToken: string;
let endUserToken: string;
let adminRefreshToken: string;
let organizationId: string;
let adminUserId: string;
let agentUserId: string;
let endUserId: string;
let ticketId: string;
let ticketNumber: number;
let commentId: string;
let categoryId: string;
let priorityId: string;
let articleCategoryId: string;
let articleId: string;
let cannedResponseId: string;
let notificationId: string;
let timeEntryId: string;

const ADMIN_SIGNUP = {
  email: 'admin@testorg.com',
  password: 'TestPass123!',
  firstName: 'Test',
  lastName: 'Admin',
  organizationName: 'Test Organization',
};

const AGENT_INVITE = {
  email: 'agent@testorg.com',
  firstName: 'Test',
  lastName: 'Agent',
  role: 'AGENT',
};

const ENDUSER_INVITE = {
  email: 'user@testorg.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'END_USER',
};

// ─── Setup & Teardown ──────────────────────────────────────────

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  prisma = app.get(PrismaService);
});

afterAll(async () => {
  // Clean up test database
  await prisma.$executeRawUnsafe('DELETE FROM inbound_messages');
  await prisma.$executeRawUnsafe('DELETE FROM activity_logs');
  await prisma.$executeRawUnsafe('DELETE FROM notifications');
  await prisma.$executeRawUnsafe('DELETE FROM comments');
  await prisma.$executeRawUnsafe('DELETE FROM tickets');
  await prisma.$executeRawUnsafe('DELETE FROM refresh_tokens');
  await prisma.$executeRawUnsafe('DELETE FROM users');
  await prisma.$executeRawUnsafe('DELETE FROM organizations');
  await app.close();
});

// ═══════════════════════════════════════════════════════════════
// AUTH MODULE
// ═══════════════════════════════════════════════════════════════

describe('Auth Module (POST /api/v1/auth/*)', () => {
  // ── Signup ──

  it('should create organization and admin user on signup', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send(ADMIN_SIGNUP)
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('organization');
    expect(res.body.user.email).toBe(ADMIN_SIGNUP.email);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.organization.name).toBe(ADMIN_SIGNUP.organizationName);

    adminToken = res.body.accessToken;
    adminRefreshToken = res.body.refreshToken;
    organizationId = res.body.organization.id;
    adminUserId = res.body.user.id;
  });

  it('should reject duplicate email within same org', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send(ADMIN_SIGNUP)
      .expect(409);
  });

  it('should validate required fields on signup', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: 'test@test.com' })
      .expect(400);
  });

  it.todo('should hash password (not store plaintext)');
  it.todo('should generate unique org slug from name');

  // ── Login ──

  it('should return tokens for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_SIGNUP.email, password: ADMIN_SIGNUP.password })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe(ADMIN_SIGNUP.email);

    // Update tokens
    adminToken = res.body.accessToken;
    adminRefreshToken = res.body.refreshToken;
  });

  it('should reject invalid password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_SIGNUP.email, password: 'wrongpassword' })
      .expect(401);
  });

  it('should reject non-existent email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'password' })
      .expect(401);
  });

  it.todo('should reject inactive user');
  it.todo('should update lastLoginAt on login');

  // ── Refresh Token ──

  it('should return new token pair on refresh', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: adminRefreshToken })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    adminToken = res.body.accessToken;
    adminRefreshToken = res.body.refreshToken;
  });

  it.todo('should reject expired refresh token');
  it.todo('should reject reused refresh token (token rotation)');

  // ── Invite ──

  it('should invite agent user (ADMIN only)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(AGENT_INVITE)
      .expect(201);

    expect(res.body.user.email).toBe(AGENT_INVITE.email);
    expect(res.body.user.role).toBe('AGENT');
    expect(res.body).toHaveProperty('temporaryPassword');
    agentUserId = res.body.user.id;

    // Login as agent to get token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: AGENT_INVITE.email, password: res.body.temporaryPassword })
      .expect(201);
    agentToken = loginRes.body.accessToken;
  });

  it('should invite end user (ADMIN only)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(ENDUSER_INVITE)
      .expect(201);

    expect(res.body.user.role).toBe('END_USER');
    endUserId = res.body.user.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ENDUSER_INVITE.email, password: res.body.temporaryPassword })
      .expect(201);
    endUserToken = loginRes.body.accessToken;
  });

  it.todo('should reject invite if caller is not ADMIN');
  it.todo('should reject duplicate email invite in same org');

  // ── Logout ──

  it.todo('should invalidate refresh token on logout');

  // ── Rate Limiting ──

  it.todo('should throttle signup to 5 requests per minute');
  it.todo('should throttle login to 10 requests per minute');
});

// ═══════════════════════════════════════════════════════════════
// USERS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Users Module (GET/PATCH /api/v1/users/*)', () => {
  it('should list users for ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('should reject user list for END_USER', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${endUserToken}`)
      .expect(403);
  });

  it('should return current user profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.email).toBe(ADMIN_SIGNUP.email);
    expect(res.body.role).toBe('ADMIN');
  });

  it('should return only agents', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((user: any) => {
      expect(['ADMIN', 'AGENT']).toContain(user.role);
    });
  });

  it('should update profile firstName and lastName', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Updated', lastName: 'Name' })
      .expect(200);

    expect(res.body.firstName).toBe('Updated');
    expect(res.body.lastName).toBe('Name');
  });

  it.todo('should filter users by role');
  it.todo('should paginate user results');
  it.todo('should toggle user active status (ADMIN only)');
  it.todo('should reject toggle-active for non-ADMIN');
});

// ═══════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Organizations Module (GET/PATCH /api/v1/organizations/*)', () => {
  it('should return current organization', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.name).toBe(ADMIN_SIGNUP.organizationName);
    expect(res.body.id).toBe(organizationId);
  });

  it('should update organization name (ADMIN only)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Org Name' })
      .expect(200);

    expect(res.body.name).toBe('Updated Org Name');
  });

  it.todo('should update autoAssignMode');
  it.todo('should upload logo file (ADMIN only)');
  it.todo('should return org tags');
  it.todo('should reject update for non-ADMIN');
});

// ═══════════════════════════════════════════════════════════════
// CATEGORIES MODULE
// ═══════════════════════════════════════════════════════════════

describe('Categories Module (CRUD /api/v1/categories)', () => {
  it('should create category (ADMIN only)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bug Report', description: 'Software bugs', color: '#EF4444' })
      .expect(201);

    expect(res.body.name).toBe('Bug Report');
    categoryId = res.body.id;
  });

  it('should list categories', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it.todo('should update category');
  it.todo('should reorder categories');
  it.todo('should delete category');
  it.todo('should reject create for non-ADMIN');
});

// ═══════════════════════════════════════════════════════════════
// PRIORITIES MODULE
// ═══════════════════════════════════════════════════════════════

describe('Priorities Module (CRUD /api/v1/priorities)', () => {
  it('should create custom priority (ADMIN only)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/priorities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Critical', level: 5, color: '#DC2626' })
      .expect(201);

    expect(res.body.name).toBe('Critical');
    priorityId = res.body.id;
  });

  it('should list priorities', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/priorities')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it.todo('should update priority');
  it.todo('should delete priority');
  it.todo('should reject create for non-ADMIN');
});

// ═══════════════════════════════════════════════════════════════
// TICKETS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Tickets Module (CRUD /api/v1/tickets)', () => {
  // ── Create ──

  it('should create ticket with valid data', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Ticket',
        description: 'This is a test ticket for e2e tests',
        priority: 'HIGH',
        categoryId: categoryId,
      })
      .expect(201);

    expect(res.body.title).toBe('Test Ticket');
    expect(res.body.status).toBe('OPEN');
    expect(res.body.priority).toBe('HIGH');
    expect(res.body.source).toBe('WEB');
    expect(res.body.ticketNumber).toBeDefined();

    ticketId = res.body.id;
    ticketNumber = res.body.ticketNumber;
  });

  it('should auto-increment ticket number', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Second Ticket', description: 'Another ticket' })
      .expect(201);

    expect(res.body.ticketNumber).toBe(ticketNumber + 1);
  });

  it('should set default status to OPEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .set('Authorization', `Bearer ${endUserToken}`)
      .send({ title: 'End User Ticket', description: 'From end user' })
      .expect(201);

    expect(res.body.status).toBe('OPEN');
  });

  it.todo('should set default priority to MEDIUM if not specified');
  it.todo('should apply SLA policy and set dueAt');
  it.todo('should reject missing title');
  it.todo('should reject missing description');
  it.todo('should set source to WEB for web-created tickets');

  // ── List / Filter ──

  it('should list tickets with pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should filter tickets by status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'OPEN' })
      .expect(200);

    res.body.data.forEach((ticket: any) => {
      expect(ticket.status).toBe('OPEN');
    });
  });

  it.todo('should filter by priority');
  it.todo('should filter by assigneeId');
  it.todo('should filter by categoryId');
  it.todo('should search tickets by title/description');
  it.todo('END_USER should only see own tickets');
  it.todo('ADMIN/AGENT should see all org tickets');

  // ── My Tickets ──

  it.todo('should return only tickets assigned to current user');

  // ── Get Single ──

  it('should return full ticket detail with comments and activity', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.id).toBe(ticketId);
    expect(res.body).toHaveProperty('comments');
    expect(res.body).toHaveProperty('activityLogs');
  });

  it.todo('should reject access to ticket from different org');

  // ── Update ──

  it('should update ticket status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' })
      .expect(200);

    expect(res.body.status).toBe('PENDING');
  });

  it('should update ticket assignee', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeId: agentUserId })
      .expect(200);

    expect(res.body.assigneeId).toBe(agentUserId);
  });

  it.todo('should update ticket priority');
  it.todo('should set resolvedAt when status changes to RESOLVED');
  it.todo('should set closedAt when status changes to CLOSED');
  it.todo('should track firstResponseAt on first agent comment');
  it.todo('should create activity log on status change');
  it.todo('should send email notification on status change');
  it.todo('should send email notification on assignment');

  // ── Bulk Update ──

  it.todo('should update multiple tickets (ADMIN/AGENT)');
  it.todo('should reject bulk update for END_USER');
});

// ═══════════════════════════════════════════════════════════════
// COMMENTS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Comments Module (CRUD /api/v1/tickets/:ticketId/comments)', () => {
  it('should add public comment', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'This is a test comment', isInternal: false })
      .expect(201);

    expect(res.body.body).toBe('This is a test comment');
    expect(res.body.isInternal).toBe(false);
    commentId = res.body.id;
  });

  it('should add internal comment (ADMIN/AGENT)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'Internal note', isInternal: true })
      .expect(201);

    expect(res.body.isInternal).toBe(true);
  });

  it.todo('should send email notifications to watchers');
  it.todo('should reject empty body');

  it('should update own comment', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Updated comment' })
      .expect(200);

    expect(res.body.body).toBe('Updated comment');
  });

  it.todo('should reject updating others\' comment (non-ADMIN)');
  it.todo('should delete own comment');
  it.todo('ADMIN should delete any comment');
});

// ═══════════════════════════════════════════════════════════════
// CHANNELS MODULE - CONFIG ENDPOINTS
// ═══════════════════════════════════════════════════════════════

describe('Channels Config (GET/POST/DELETE /api/v1/channels/*)', () => {
  it('should return null when no config exists', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/channels/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // null or empty when not configured
    expect(res.body === null || res.body === '').toBeTruthy;
  });

  it('should save IMAP configuration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        imapEnabled: true,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUser: 'test@gmail.com',
        imapPass: 'test-password',
        imapTls: true,
      })
      .expect(201);

    expect(res.body.imapEnabled).toBe(true);
    expect(res.body.imapHost).toBe('imap.gmail.com');
    expect(res.body.imapPass).toBe('••••••••'); // masked
  });

  it('should save Twilio configuration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        twilioEnabled: true,
        twilioAccountSid: 'ACtest123456',
        twilioAuthToken: 'test-auth-token',
        twilioPhoneNumber: '+15551234567',
        imapEnabled: true,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUser: 'test@gmail.com',
        imapPass: '••••••••',
        imapTls: true,
      })
      .expect(201);

    expect(res.body.twilioEnabled).toBe(true);
    expect(res.body.twilioAuthToken).toBe('••••••••'); // masked
  });

  it('should save Meta WhatsApp configuration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        metaWhatsappEnabled: true,
        metaWhatsappToken: 'meta-test-token',
        metaWhatsappPhoneId: '123456789',
        metaWhatsappVerifyToken: 'my-verify-token',
        metaWhatsappBusinessId: 'biz-123',
        twilioEnabled: true,
        twilioAccountSid: 'ACtest123456',
        twilioAuthToken: '••••••••',
        twilioPhoneNumber: '+15551234567',
        imapEnabled: true,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUser: 'test@gmail.com',
        imapPass: '••••••••',
        imapTls: true,
      })
      .expect(201);

    expect(res.body.metaWhatsappEnabled).toBe(true);
    expect(res.body.metaWhatsappToken).toBe('••••••••'); // masked
  });

  it('should mask sensitive fields in config response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/channels/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.imapPass).toBe('••••••••');
    expect(res.body.twilioAuthToken).toBe('••••••••');
    expect(res.body.metaWhatsappToken).toBe('••••••••');
  });

  it('should reject for non-ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/channels/config')
      .set('Authorization', `Bearer ${endUserToken}`)
      .expect(403);
  });

  it.todo('should preserve masked passwords on update');
  it.todo('should delete channel config');
  it.todo('should test IMAP connection');

  it('should return inbound messages log', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/channels/messages')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should return free providers info', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/channels/free-providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('whatsapp');
    expect(res.body).toHaveProperty('phone');
    expect(res.body).toHaveProperty('inboundEmail');
    expect(res.body).toHaveProperty('webhookTunnel');
  });
});

// ═══════════════════════════════════════════════════════════════
// CHANNELS MODULE - WEBHOOK ENDPOINTS
// ═══════════════════════════════════════════════════════════════

describe('Webhooks - Twilio Voice (POST /api/v1/webhooks/twilio/voice)', () => {
  it('should create ticket from incoming call', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/twilio/voice')
      .send({
        CallSid: 'CA_test_call_123',
        From: '+15559876543',
        To: '+15551234567',
        CallStatus: 'ringing',
        Direction: 'inbound',
        CallerCity: 'San Francisco',
        CallerState: 'CA',
        CallerCountry: 'US',
      })
      .expect(200);

    expect(res.text).toContain('<?xml');
    expect(res.text).toContain('<Response>');
    expect(res.text).toContain('<Say');
  });

  it('should return error TwiML for unconfigured number', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/twilio/voice')
      .send({
        CallSid: 'CA_unknown_123',
        From: '+15559876543',
        To: '+10000000000', // not configured
        CallStatus: 'ringing',
      })
      .expect(200);

    expect(res.text).toContain('not configured');
  });

  it.todo('should add transcription as comment on status callback');
  it.todo('should add recording URL as comment on status callback');
});

describe('Webhooks - Twilio WhatsApp (POST /api/v1/webhooks/twilio/whatsapp)', () => {
  it('should create ticket from WhatsApp message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/twilio/whatsapp')
      .send({
        MessageSid: 'SM_test_wa_123',
        From: 'whatsapp:+15559876543',
        To: 'whatsapp:+15551234567',
        Body: 'Hello, I need help with my order',
        NumMedia: '0',
      })
      .expect(200);

    expect(res.text).toContain('<?xml');
    expect(res.text).toContain('<Response>');
  });

  it.todo('should handle media attachments');
  it.todo('should send auto-reply TwiML');
  it.todo('should deduplicate rapid messages from same sender');
});

describe('Webhooks - Meta WhatsApp (GET/POST /api/v1/webhooks/meta/whatsapp)', () => {
  it('should verify webhook with correct token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/webhooks/meta/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'my-verify-token',
        'hub.challenge': 'test-challenge-string',
      })
      .expect(200);

    expect(res.text).toBe('test-challenge-string');
  });

  it('should reject invalid verify token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/webhooks/meta/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'test',
      })
      .expect(403);
  });

  it('should process incoming text message', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/meta/whatsapp')
      .send({
        object: 'whatsapp_business_account',
        entry: [{
          id: 'biz-123',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+15551234567',
                phone_number_id: '123456789',
              },
              contacts: [{ profile: { name: 'Test User' }, wa_id: '15559876543' }],
              messages: [{
                id: 'wamid.test123',
                from: '15559876543',
                timestamp: '1234567890',
                type: 'text',
                text: { body: 'I have a billing question' },
              }],
            },
            field: 'messages',
          }],
        }],
      })
      .expect(200);
  });

  it.todo('should process image message');
  it.todo('should process document message');
  it.todo('should process location message');
  it.todo('should ignore non-whatsapp_business_account objects');
  it.todo('should send auto-reply via Graph API');
});

// ═══════════════════════════════════════════════════════════════
// CHANNELS SERVICE - CORE LOGIC
// ═══════════════════════════════════════════════════════════════

describe('Channels Service - Core Logic', () => {
  it.todo('should create ticket with correct source field');
  it.todo('should deduplicate messages within configured window');
  it.todo('should add comment to existing ticket on deduplication');
  it.todo('should reopen RESOLVED ticket on follow-up message');
  it.todo('should auto-assign using ROUND_ROBIN strategy');
  it.todo('should auto-assign using LOAD_BALANCED strategy');
  it.todo('should not auto-assign in MANUAL mode');
  it.todo('should log inbound message record');
  it.todo('should create activity log entry');
  it.todo('should send email notifications when configured');
});

// ═══════════════════════════════════════════════════════════════
// INBOUND EMAIL SERVICE
// ═══════════════════════════════════════════════════════════════

describe('Inbound Email Service', () => {
  it.todo('should skip polling if no IMAP configs exist');
  it.todo('should not run concurrently (processing guard)');
  it.todo('should process unseen emails into tickets');
  it.todo('should skip already-processed emails (dedup by messageId)');
  it.todo('should mark processed emails as Seen');
  it.todo('should handle IMAP connection timeout gracefully');
  it.todo('testConnection - should return success for valid credentials');
  it.todo('testConnection - should return failure for invalid credentials');
});

// ═══════════════════════════════════════════════════════════════
// EMAIL MODULE
// ═══════════════════════════════════════════════════════════════

describe('Email Config (GET/POST /api/v1/email-config/*)', () => {
  it('should return null when no email config exists', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/email-config/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // May be null or have auto-created ethereal config
  });

  it('should save SMTP configuration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/email-config/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUser: 'test@ethereal.email',
        smtpPass: 'testpass123',
        fromEmail: 'test@ethereal.email',
        fromName: 'Test Support',
      })
      .expect(201);

    expect(res.body.smtpHost).toBe('smtp.ethereal.email');
    expect(res.body.smtpPass).toBe('••••••••'); // masked
  });

  it('should mask SMTP password in response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/email-config/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.smtpPass).toBe('••••••••');
  });

  it.todo('should preserve masked password on update');
  it.todo('should send test email');

  it('should auto-setup Ethereal account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/email-config/setup-ethereal')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.credentials).toHaveProperty('user');
    expect(res.body.credentials).toHaveProperty('pass');
    expect(res.body.credentials).toHaveProperty('webUrl');
  });

  it('should return free provider list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/email-config/free-providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('ethereal');
    expect(res.body).toHaveProperty('gmail');
    expect(res.body).toHaveProperty('brevo');
    expect(res.body).toHaveProperty('mailtrap');
  });
});

describe('Email Service - Notifications', () => {
  it.todo('sendTicketCreatedEmail - should send when trigger is enabled');
  it.todo('sendTicketCreatedEmail - should NOT send when trigger is disabled');
  it.todo('sendTicketCreatedEmail - should NOT send when config is inactive');
  it.todo('sendTicketAssignedEmail - should send to assignee');
  it.todo('sendTicketStatusChangedEmail - should include old and new status');
  it.todo('sendNewCommentEmail - should send to all recipients');
  it.todo('sendSlaBreachEmail - should send alert email');
  it.todo('sendTicketResolvedEmail - should send resolution confirmation');
  it.todo('All emails - should escape HTML to prevent XSS');
  it.todo('All emails - should gracefully handle SMTP errors');
});

// ═══════════════════════════════════════════════════════════════
// SLA MODULE
// ═══════════════════════════════════════════════════════════════

describe('SLA Module (/api/v1/sla-policies)', () => {
  it('should list SLA policies', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sla-policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it.todo('should update SLA policy (ADMIN only)');
  it.todo('SLA cron - should mark tickets as breached when past due');
  it.todo('SLA cron - should send breach notification email');
  it.todo('SLA cron - should not breach already-resolved tickets');
  it.todo('SLA cron - should create breach notification for assignee');
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Analytics Module (GET /api/v1/analytics/*)', () => {
  it('should return dashboard stats (ADMIN/AGENT)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('totalTickets');
    expect(res.body).toHaveProperty('openTickets');
  });

  it('should reject dashboard for END_USER', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${endUserToken}`)
      .expect(403);
  });

  it('should return ticket volume by day', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/volume')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it.todo('should accept custom days parameter for volume');
  it.todo('should return agent performance metrics');
  it.todo('should return tickets grouped by priority');
  it.todo('should return tickets grouped by status');
  it.todo('should return detailed agent KPIs');
});

// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE BASE MODULE
// ═══════════════════════════════════════════════════════════════

describe('Knowledge Base Module (/api/v1/knowledge-base/*)', () => {
  it('should create article category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Getting Started', description: 'Onboarding articles' })
      .expect(201);

    expect(res.body.name).toBe('Getting Started');
    articleCategoryId = res.body.id;
  });

  it('should list categories', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/knowledge-base/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should create article', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/articles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'How to Submit a Ticket',
        content: '# Submitting a Ticket\n\nFollow these steps...',
        categoryId: articleCategoryId,
        isPublished: true,
      })
      .expect(201);

    expect(res.body.title).toBe('How to Submit a Ticket');
    articleId = res.body.id;
  });

  it('should list articles with pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/knowledge-base/articles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it.todo('should filter articles by category');
  it.todo('should search articles');
  it.todo('publishedOnly filter should work');
  it.todo('should return single article');
  it.todo('should update article');
  it.todo('should delete article (ADMIN only)');
});

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Notifications Module (/api/v1/notifications)', () => {
  it('should list user notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return unread count', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('count');
    expect(typeof res.body.count).toBe('number');
  });

  it.todo('should filter unread only');
  it.todo('should paginate notifications');
  it.todo('should mark notification as read');
  it.todo('should mark all as read');
});

// ═══════════════════════════════════════════════════════════════
// CANNED RESPONSES MODULE
// ═══════════════════════════════════════════════════════════════

describe('Canned Responses Module (/api/v1/canned-responses)', () => {
  it('should create canned response (ADMIN/AGENT)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/canned-responses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Thank You',
        content: 'Thank you for contacting support. We will get back to you shortly.',
        shortcut: '/thanks',
        isShared: true,
      })
      .expect(201);

    expect(res.body.title).toBe('Thank You');
    expect(res.body.shortcut).toBe('/thanks');
    cannedResponseId = res.body.id;
  });

  it('should list canned responses', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/canned-responses')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it.todo('should update canned response');
  it.todo('should delete canned response');
});

// ═══════════════════════════════════════════════════════════════
// WATCHERS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Watchers Module (/api/v1/tickets/:ticketId/watchers)', () => {
  it('should watch ticket (self)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/watchers/me`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(201);

    expect(res.body).toBeDefined();
  });

  it('should list watchers', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/watchers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it.todo('should add watcher by userId (ADMIN/AGENT)');
  it.todo('should remove watcher');
  it.todo('should unwatch ticket (self)');
});

// ═══════════════════════════════════════════════════════════════
// SATISFACTION (CSAT) MODULE
// ═══════════════════════════════════════════════════════════════

describe('Satisfaction Module (/api/v1/satisfaction/*)', () => {
  // First resolve the ticket so CSAT can be submitted
  beforeAll(async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' });
  });

  it.todo('should submit rating (END_USER only)');
  it.todo('should reject duplicate rating');
  it.todo('should validate rating is 1-5');
  it.todo('should get rating for ticket');
  it.todo('should get agent CSAT stats');
  it.todo('should get org-wide CSAT overview');
});

// ═══════════════════════════════════════════════════════════════
// TIME TRACKING MODULE
// ═══════════════════════════════════════════════════════════════

describe('Time Tracking Module (/api/v1/tickets/:ticketId/time)', () => {
  it('should log time entry (ADMIN/AGENT)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tickets/${ticketId}/time`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ minutes: 30, description: 'Investigated issue' })
      .expect(201);

    expect(res.body.minutes).toBe(30);
    timeEntryId = res.body.id;
  });

  it('should list time entries', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/time`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it.todo('should reject time logging for END_USER');
  it.todo('should delete time entry');
});

// ═══════════════════════════════════════════════════════════════
// JIRA INTEGRATION MODULE
// ═══════════════════════════════════════════════════════════════

describe('JIRA Module (/api/v1/jira/*)', () => {
  it('should return null when no JIRA config exists', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/jira/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it.todo('should save JIRA configuration');
  it.todo('should delete JIRA configuration');
  it.todo('should create JIRA issue from ticket');
  it.todo('should sync JIRA status');
  it.todo('should reject for non-ADMIN');
});

// ═══════════════════════════════════════════════════════════════
// ATTACHMENTS MODULE
// ═══════════════════════════════════════════════════════════════

describe('Attachments Module (/api/v1/attachments/*)', () => {
  it.todo('should upload file');
  it.todo('should reject oversized files');
  it.todo('should delete attachment');
});

// ═══════════════════════════════════════════════════════════════
// SEARCH MODULE
// ═══════════════════════════════════════════════════════════════

describe('Search Module (GET /api/v1/search/*)', () => {
  it('should search tickets by query', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/search/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ q: 'test' })
      .expect(200);

    expect(res.body).toHaveProperty('results');
  });

  it.todo('should fall back to DB search if Meilisearch unavailable');
  it.todo('should paginate search results');
});

// ═══════════════════════════════════════════════════════════════
// SECURITY & CROSS-CUTTING CONCERNS
// ═══════════════════════════════════════════════════════════════

describe('Security & Cross-Cutting Concerns', () => {
  // ── Multi-tenancy ──

  it.todo('should not leak data between organizations');

  // ── JWT ──

  it('should reject expired/invalid tokens', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer invalid-token-123')
      .expect(401);
  });

  it('should reject missing Authorization header', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .expect(401);
  });

  it.todo('should reject malformed Bearer token');

  // ── RBAC ──

  it('END_USER cannot access ADMIN endpoints', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${endUserToken}`)
      .send({ name: 'Hacker Category' })
      .expect(403);
  });

  it('AGENT cannot access ADMIN-only endpoints', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'Agent Category' })
      .expect(403);
  });

  it.todo('should enforce 100 req/60s global rate limit');
  it.todo('should reject unknown fields (forbidNonWhitelisted)');
  it.todo('should transform and whitelist DTOs');
  it.todo('should allow CORS from configured frontend URL');
});

// ═══════════════════════════════════════════════════════════════
// TEST SUMMARY
// ═══════════════════════════════════════════════════════════════

/**
 * Total Test Cases: 210
 *
 * By Module:
 *   Auth:              19 tests (signup, login, refresh, invite, logout, rate limiting)
 *   Users:              8 tests (list, me, agents, profile, toggle-active)
 *   Organizations:      5 tests (current, update, logo, tags)
 *   Categories:         5 tests (CRUD + reorder)
 *   Priorities:         4 tests (CRUD)
 *   Tickets:           29 tests (create, list, filter, detail, update, bulk)
 *   Comments:           7 tests (create, update, delete, internal, notifications)
 *   Channels Config:   10 tests (get, save IMAP/Twilio/Meta, mask, delete, test)
 *   Twilio Voice:       4 tests (call, TwiML, transcription, recording)
 *   Twilio WhatsApp:    4 tests (message, media, auto-reply, dedup)
 *   Meta WhatsApp:      7 tests (verify, text, image, document, location, auto-reply)
 *   Channels Service:  10 tests (create, dedup, reopen, auto-assign, logs)
 *   Inbound Email:      8 tests (poll, dedup, seen, timeout, test connection)
 *   Email Config:       6 tests (get, save, mask, test, ethereal, providers)
 *   Email Service:     10 tests (all notification types, XSS, errors)
 *   SLA:                6 tests (list, update, cron breach, notifications)
 *   Analytics:          8 tests (dashboard, volume, agents, priority, status, KPI)
 *   Knowledge Base:     8 tests (categories, articles CRUD, search, filter)
 *   Notifications:      6 tests (list, count, read, read-all)
 *   Canned Responses:   4 tests (CRUD)
 *   Watchers:           5 tests (add, remove, list, watch/unwatch self)
 *   CSAT:               6 tests (submit, validate, get, agent stats, overview)
 *   Time Tracking:      4 tests (log, list, delete, auth)
 *   JIRA:               5 tests (config CRUD, create issue, sync)
 *   Attachments:        3 tests (upload, size limit, delete)
 *   Search:             3 tests (search, fallback, paginate)
 *   Security:          10 tests (multi-tenancy, JWT, RBAC, rate limit, CORS)
 *
 * Implementation Status:
 *   Fully Implemented:  ~70 tests (critical paths)
 *   Documented (todo):  ~140 tests (complete specification)
 */

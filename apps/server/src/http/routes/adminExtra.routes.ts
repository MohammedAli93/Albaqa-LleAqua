/**
 * Admin extras: media signing, bulk import, analytics, sessions, users, audit.
 * Mounted under /api/v1/admin alongside admin.routes.ts.
 */
import { Router, type Router as ExpressRouter, json } from 'express';
import { z } from 'zod';
import {
  UserRole,
  SignUploadSchema,
  PaginationSchema,
  AppError,
  ErrorCode,
} from '@tahaddi/shared';
import { validate, valid } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { ok } from '../respond.js';
import { audit } from '../../domain/audit.js';
import * as media from '../../domain/media/mediaService.js';
import * as importer from '../../domain/content/importService.js';
import * as analytics from '../../domain/analytics/analyticsService.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../domain/auth/password.js';

export const adminExtraRouter: ExpressRouter = Router();
adminExtraRouter.use(requireAuth);

const idParam = z.object({ id: z.string().uuid() });

// ── Media ─────────────────────────────────────────────────────────────────────
adminExtraRouter.post(
  '/media/sign-upload',
  requireRole(UserRole.EDITOR),
  validate(SignUploadSchema),
  asyncHandler(async (req, res) => {
    const input = valid<typeof SignUploadSchema>(req);
    ok(res, await media.signUpload(input.type, input.mimeType, input.sizeBytes, req.auth!.userId));
  }),
);

adminExtraRouter.post(
  '/media/:id/complete',
  requireRole(UserRole.EDITOR),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    ok(res, await media.completeUpload(id));
  }),
);

adminExtraRouter.get(
  '/media',
  requireRole(UserRole.VIEWER),
  validate(PaginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { cursor, limit } = valid<typeof PaginationSchema>(req, 'query');
    ok(res, { items: await media.listMedia(cursor, limit) });
  }),
);

adminExtraRouter.delete(
  '/media/:id',
  requireRole(UserRole.ADMIN),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    await media.deleteMedia(id);
    ok(res, { deleted: true });
  }),
);

// ── Bulk import (CSV/XLSX as base64 to avoid multipart) ───────────────────────
const ImportPreviewSchema = z.object({
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
});
const ImportCommitSchema = z.object({ importId: z.string().min(1) });

adminExtraRouter.post(
  '/questions/import/preview',
  requireRole(UserRole.EDITOR),
  json({ limit: '16mb' }),
  validate(ImportPreviewSchema),
  asyncHandler(async (req, res) => {
    const { filename, contentBase64 } = valid<typeof ImportPreviewSchema>(req);
    const buffer = Buffer.from(contentBase64, 'base64');
    if (buffer.length > 16 * 1024 * 1024) throw new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 'File too large');
    ok(res, await importer.preview(buffer, filename));
  }),
);

adminExtraRouter.post(
  '/questions/import/commit',
  requireRole(UserRole.EDITOR),
  validate(ImportCommitSchema),
  asyncHandler(async (req, res) => {
    const { importId } = valid<typeof ImportCommitSchema>(req);
    const result = await importer.commit(importId);
    await audit({ actorId: req.auth!.userId, action: 'question.import', entityType: 'Question', metadata: result, ip: req.ip });
    ok(res, result);
  }),
);

adminExtraRouter.get('/questions/import/template', requireRole(UserRole.VIEWER), (_req, res) =>
  ok(res, { headers: importer.IMPORT_HEADERS }),
);

// ── Analytics & sessions ──────────────────────────────────────────────────────
const DateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

adminExtraRouter.get(
  '/analytics/overview',
  requireRole(UserRole.VIEWER),
  validate(DateRangeSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { from, to } = valid<typeof DateRangeSchema>(req, 'query');
    ok(res, await analytics.overview(from, to));
  }),
);

adminExtraRouter.get(
  '/sessions',
  requireRole(UserRole.VIEWER),
  validate(PaginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { cursor, limit } = valid<typeof PaginationSchema>(req, 'query');
    ok(res, await analytics.listSessions(cursor, limit));
  }),
);

adminExtraRouter.get(
  '/sessions/:id',
  requireRole(UserRole.VIEWER),
  validate(z.object({ id: z.string().uuid() }), 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<z.ZodObject<{ id: z.ZodString }>>(req, 'params');
    ok(res, await analytics.sessionDetail(id));
  }),
);

adminExtraRouter.get('/revenue/overview', requireRole(UserRole.ADMIN), asyncHandler(async (_req, res) =>
  ok(res, await analytics.revenueOverview()),
));

// ── Users (SUPER_ADMIN) ────────────────────────────────────────────────────────
const CreateUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  password: z.string().min(8).max(200),
  role: z.enum([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER]),
});

adminExtraRouter.get('/users', requireRole(UserRole.SUPER_ADMIN), asyncHandler(async (_req, res) =>
  ok(res, { users: await prisma.user.findMany({ select: { id: true, email: true, displayName: true, role: true, isActive: true, lastLoginAt: true }, orderBy: { createdAt: 'desc' } }) }),
));

adminExtraRouter.post(
  '/users',
  requireRole(UserRole.SUPER_ADMIN),
  validate(CreateUserSchema),
  asyncHandler(async (req, res) => {
    const input = valid<typeof CreateUserSchema>(req);
    const user = await prisma.user.create({
      data: { email: input.email.toLowerCase(), displayName: input.displayName, role: input.role, passwordHash: await hashPassword(input.password) },
      select: { id: true, email: true, role: true },
    });
    await audit({ actorId: req.auth!.userId, action: 'user.create', entityType: 'User', entityId: user.id, ip: req.ip });
    ok(res, user, 201);
  }),
);

adminExtraRouter.post(
  '/users/:id/revoke-tokens',
  requireRole(UserRole.SUPER_ADMIN),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    await prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    await audit({ actorId: req.auth!.userId, action: 'user.revoke', entityType: 'User', entityId: id, ip: req.ip });
    ok(res, { revoked: true });
  }),
);

adminExtraRouter.get(
  '/audit',
  requireRole(UserRole.ADMIN),
  validate(PaginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { cursor, limit } = valid<typeof PaginationSchema>(req, 'query');
    const items = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { actor: { select: { email: true, displayName: true } } },
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    ok(res, { items: page, nextCursor: hasMore ? page[page.length - 1]!.id : null });
  }),
);

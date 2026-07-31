/** Admin content management (categories, questions, packages). Auth + RBAC. */
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import {
  UserRole,
  CategoryInputSchema,
  CategoryEditSchema,
  CategoryGroupInputSchema,
  CategoryGroupEditSchema,
  QuestionInputSchema,
  QuestionBaseSchema,
  PackageInputSchema,
  PackageQuestionsSchema,
  PaginationSchema,
} from '@tahaddi/shared';
import { validate, valid } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { ok } from '../respond.js';
import { audit } from '../../domain/audit.js';
import * as content from '../../domain/content/contentService.js';

export const adminRouter: ExpressRouter = Router();
adminRouter.use(requireAuth);

const idParam = z.object({ id: z.string().uuid() });

// ── Category groups ──────────────────────────────────────────────────────────
// The panel files every category under a group, so the owner picks a parent from a
// dropdown and browses by filter instead of scrolling one flat list.
adminRouter.get(
  '/category-groups',
  requireRole(UserRole.VIEWER),
  asyncHandler(async (_req, res) => ok(res, { groups: await content.listAdminCategoryGroups() })),
);

adminRouter.post(
  '/category-groups',
  requireRole(UserRole.EDITOR),
  validate(CategoryGroupInputSchema),
  asyncHandler(async (req, res) => {
    const group = await content.createCategoryGroup(valid<typeof CategoryGroupInputSchema>(req));
    await audit({ actorId: req.auth!.userId, action: 'categoryGroup.create', entityType: 'CategoryGroup', entityId: group.id, ip: req.ip });
    ok(res, group, 201);
  }),
);

adminRouter.patch(
  '/category-groups/:id',
  requireRole(UserRole.EDITOR),
  validate(idParam, 'params'),
  validate(CategoryGroupEditSchema),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    const input = valid<typeof CategoryGroupEditSchema>(req);
    const group = await content.updateCategoryGroup(id, input);
    await audit({ actorId: req.auth!.userId, action: 'categoryGroup.update', entityType: 'CategoryGroup', entityId: id, metadata: input, ip: req.ip });
    ok(res, group);
  }),
);

// ── Categories ───────────────────────────────────────────────────────────────
adminRouter.get(
  '/categories',
  requireRole(UserRole.VIEWER),
  asyncHandler(async (_req, res) => ok(res, { categories: await content.listCategories() })),
);

adminRouter.post(
  '/categories',
  requireRole(UserRole.EDITOR),
  validate(CategoryInputSchema),
  asyncHandler(async (req, res) => {
    const cat = await content.createCategory(valid<typeof CategoryInputSchema>(req));
    await audit({ actorId: req.auth!.userId, action: 'category.create', entityType: 'Category', entityId: cat.id, ip: req.ip });
    ok(res, cat, 201);
  }),
);

adminRouter.patch(
  '/categories/:id',
  requireRole(UserRole.EDITOR),
  validate(idParam, 'params'),
  validate(CategoryEditSchema),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    const input = valid<typeof CategoryEditSchema>(req);
    // Editing name, colour or parent group is the owner taking the category over from
    // the taxonomy: flag the row so the next `db:seed` keeps their version of it.
    const owned =
      input.nameAr !== undefined || input.nameEn !== undefined ||
      input.color !== undefined || input.groupId !== undefined;
    const cat = await content.updateCategory(id, { ...input, ...(owned && { adminEdited: true }) });
    await audit({ actorId: req.auth!.userId, action: 'category.update', entityType: 'Category', entityId: id, metadata: input, ip: req.ip });
    ok(res, cat);
  }),
);

adminRouter.delete(
  '/categories/:id',
  requireRole(UserRole.ADMIN),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    await content.softDeleteCategory(id);
    await audit({ actorId: req.auth!.userId, action: 'category.delete', entityType: 'Category', entityId: id, ip: req.ip });
    ok(res, { deleted: true });
  }),
);

// ── Questions ────────────────────────────────────────────────────────────────
const QuestionFilterSchema = PaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  type: z.string().optional(),
  difficulty: z.string().optional(),
  isApproved: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().optional(),
});

adminRouter.get(
  '/questions',
  requireRole(UserRole.VIEWER),
  validate(QuestionFilterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const f = valid<typeof QuestionFilterSchema>(req, 'query');
    ok(res, await content.listQuestions(f, f.cursor, f.limit));
  }),
);

adminRouter.get(
  '/questions/:id',
  requireRole(UserRole.VIEWER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    ok(res, await content.getQuestion(id));
  }),
);

adminRouter.post(
  '/questions',
  requireRole(UserRole.EDITOR),
  validate(QuestionInputSchema),
  asyncHandler(async (req, res) => {
    const input = valid<typeof QuestionInputSchema>(req);
    const q = await content.createQuestion({
      ...input,
      options: input.options,
      // Tagged so the seed's prune (which retires questions dropped from the static
      // bank) never deletes a question an editor added by hand.
      tags: input.tags?.includes('admin') ? input.tags : [...(input.tags ?? []), 'admin'],
      // Live the moment it's saved. The draw filters on isApproved, and the DB default
      // is false — so without this a question added in the panel would sit invisible
      // until someone thought to flip the Approved toggle. The toggle stays available
      // for pulling a question back out of rotation.
      isApproved: true,
    } as Parameters<typeof content.createQuestion>[0]);
    await audit({ actorId: req.auth!.userId, action: 'question.create', entityType: 'Question', entityId: q.id, ip: req.ip });
    ok(res, q, 201);
  }),
);

adminRouter.patch(
  '/questions/:id',
  requireRole(UserRole.EDITOR),
  validate(idParam, 'params'),
  validate(QuestionBaseSchema.partial()),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    const input = valid<ReturnType<typeof QuestionBaseSchema.partial>>(req) as Record<string, unknown>;
    const q = await content.updateQuestion(
      id,
      input as Parameters<typeof content.updateQuestion>[1],
    );
    await audit({ actorId: req.auth!.userId, action: 'question.update', entityType: 'Question', entityId: id, ip: req.ip });
    ok(res, q);
  }),
);

adminRouter.delete(
  '/questions/:id',
  requireRole(UserRole.ADMIN),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    await content.softDeleteQuestion(id);
    await audit({ actorId: req.auth!.userId, action: 'question.delete', entityType: 'Question', entityId: id, ip: req.ip });
    ok(res, { deleted: true });
  }),
);

adminRouter.post(
  '/questions/:id/approve',
  requireRole(UserRole.ADMIN),
  validate(idParam, 'params'),
  validate(z.object({ isApproved: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    const { isApproved } = valid<z.ZodObject<{ isApproved: z.ZodBoolean }>>(req);
    ok(res, await content.setApproved(id, isApproved));
  }),
);

// ── Packages ─────────────────────────────────────────────────────────────────
adminRouter.get(
  '/packages',
  requireRole(UserRole.VIEWER),
  asyncHandler(async (_req, res) => ok(res, { packages: await content.listPackages() })),
);

adminRouter.post(
  '/packages',
  requireRole(UserRole.EDITOR),
  validate(PackageInputSchema),
  asyncHandler(async (req, res) => {
    const pkg = await content.createPackage({ ...valid<typeof PackageInputSchema>(req), createdById: req.auth!.userId });
    await audit({ actorId: req.auth!.userId, action: 'package.create', entityType: 'Package', entityId: pkg.id, ip: req.ip });
    ok(res, pkg, 201);
  }),
);

adminRouter.patch(
  '/packages/:id',
  requireRole(UserRole.EDITOR),
  validate(idParam, 'params'),
  validate(PackageInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    ok(res, await content.updatePackage(id, valid<typeof PackageInputSchema>(req)));
  }),
);

adminRouter.put(
  '/packages/:id/questions',
  requireRole(UserRole.EDITOR),
  validate(idParam, 'params'),
  validate(PackageQuestionsSchema),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    const { questions } = valid<typeof PackageQuestionsSchema>(req);
    ok(res, await content.setPackageQuestions(id, questions));
  }),
);

adminRouter.post(
  '/packages/:id/publish',
  requireRole(UserRole.ADMIN),
  validate(idParam, 'params'),
  validate(z.object({ isPublished: z.boolean() })),
  asyncHandler(async (req, res) => {
    const { id } = valid<typeof idParam>(req, 'params');
    const { isPublished } = valid<z.ZodObject<{ isPublished: z.ZodBoolean }>>(req);
    await content.publishPackage(id, isPublished);
    await audit({ actorId: req.auth!.userId, action: 'package.publish', entityType: 'Package', entityId: id, metadata: { isPublished }, ip: req.ip });
    ok(res, { published: isPublished });
  }),
);

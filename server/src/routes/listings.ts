import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { findSmartMatchesForUser } from '../services/matchingService.js';
import { createNotification } from '../services/notificationService.js';

const router = Router();

const createListingSchema = z.object({
  courseId: z.string().min(1, 'აირჩიეთ საგანი'),
  currentLecturerId: z.string().optional().nullable(),
  currentLecturerName: z.string().trim().min(2, 'მიუთითეთ მიმდინარე ლექტორი'),
  currentGroupId: z.string().optional().nullable(),
  currentGroupCode: z.string().trim().min(1, 'მიუთითეთ მიმდინარე ჯგუფი'),
  currentDay: z.string().trim().min(2, 'მიუთითეთ ლექციის დღე'),
  currentTime: z.string().trim().min(3, 'მიუთითეთ ლექციის დრო'),
  desiredLecturerId: z.string().optional().nullable(),
  desiredLecturerName: z.string().trim().optional().nullable(),
  desiredGroupCode: z.string().trim().optional().nullable(),
  desiredDay: z.string().trim().optional().nullable(),
  desiredTime: z.string().trim().min(2, 'მიუთითეთ სასურველი დრო'),
  comment: z.string().trim().max(600, 'კომენტარი ძალიან გრძელია').optional().nullable(),
});

const listingInclude = {
  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      studyYear: true,
      studentVerificationStatus: true,
      university: { select: { id: true, name: true, shortName: true } },
      faculty: { select: { id: true, name: true } },
    },
  },
  university: { select: { id: true, name: true, shortName: true } },
  course: { select: { id: true, code: true, name: true } },
  _count: {
    select: {
      offers: true,
      savedBy: true,
    },
  },
} satisfies Prisma.SwapListingInclude;

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const universityId = typeof req.query.universityId === 'string' ? req.query.universityId : '';
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : '';
    const lecturer = typeof req.query.lecturer === 'string' ? req.query.lecturer.trim() : '';
    const currentTime =
      typeof req.query.currentTime === 'string' ? req.query.currentTime.trim() : '';
    const desiredTime =
      typeof req.query.desiredTime === 'string' ? req.query.desiredTime.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'OPEN';
    const authorId = typeof req.query.authorId === 'string' ? req.query.authorId : '';
    const onlySaved = req.query.onlySaved === 'true';

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(40, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.SwapListingWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status as 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED';
    }
    if (universityId) where.universityId = universityId;
    if (courseId) where.courseId = courseId;
    if (authorId) where.authorId = authorId;
    if (lecturer) {
      where.OR = [
        { currentLecturerName: { contains: lecturer, mode: 'insensitive' } },
        { desiredLecturerName: { contains: lecturer, mode: 'insensitive' } },
      ];
    }
    if (currentTime) {
      where.currentTime = { contains: currentTime, mode: 'insensitive' };
    }
    if (desiredTime) {
      where.desiredTime = { contains: desiredTime, mode: 'insensitive' };
    }
    if (q) {
      where.AND = [
        {
          OR: [
            { course: { name: { contains: q, mode: 'insensitive' } } },
            { course: { code: { contains: q, mode: 'insensitive' } } },
            { currentLecturerName: { contains: q, mode: 'insensitive' } },
            { desiredLecturerName: { contains: q, mode: 'insensitive' } },
            { currentGroupCode: { contains: q, mode: 'insensitive' } },
            { currentTime: { contains: q, mode: 'insensitive' } },
            { desiredTime: { contains: q, mode: 'insensitive' } },
            { comment: { contains: q, mode: 'insensitive' } },
            { author: { firstName: { contains: q, mode: 'insensitive' } } },
            { author: { lastName: { contains: q, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    if (onlySaved && req.user) {
      where.savedBy = { some: { userId: req.user.id } };
    }

    const [listings, total] = await Promise.all([
      prisma.swapListing.findMany({
        where,
        include: listingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.swapListing.count({ where }),
    ]);

    let savedIds = new Set<string>();
    if (req.user && listings.length > 0) {
      const saved = await prisma.savedListing.findMany({
        where: {
          userId: req.user.id,
          listingId: { in: listings.map((l) => l.id) },
        },
        select: { listingId: true },
      });
      savedIds = new Set(saved.map((s) => s.listingId));
    }

    res.json({
      listings: listings.map((item) => ({
        ...item,
        isSaved: savedIds.has(item.id),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

router.get(
  '/matches',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const matches = await findSmartMatchesForUser(req.user!.id);
    res.json({ matches });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const listingId = String(req.params.id);
    const listing = await prisma.swapListing.findUnique({
      where: { id: listingId },
      include: listingInclude,
    });

    if (!listing) {
      throw new AppError('განცხადება ვერ მოიძებნა', 404);
    }

    let isSaved = false;
    if (req.user) {
      const saved = await prisma.savedListing.findUnique({
        where: {
          userId_listingId: {
            userId: req.user.id,
            listingId: listing.id,
          },
        },
      });
      isSaved = Boolean(saved);
    }

    res.json({ listing: { ...listing, isSaved } });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = createListingSchema.parse(req.body);
    const userId = req.user!.id;

    const course = await prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) {
      throw new AppError('არჩეული საგანი ვერ მოიძებნა', 404);
    }

    const listing = await prisma.swapListing.create({
      data: {
        authorId: userId,
        universityId: course.universityId,
        courseId: course.id,
        currentLecturerId: data.currentLecturerId || null,
        currentLecturerName: data.currentLecturerName,
        currentGroupId: data.currentGroupId || null,
        currentGroupCode: data.currentGroupCode,
        currentDay: data.currentDay,
        currentTime: data.currentTime,
        desiredLecturerId: data.desiredLecturerId || null,
        desiredLecturerName: data.desiredLecturerName || null,
        desiredGroupCode: data.desiredGroupCode || null,
        desiredDay: data.desiredDay || null,
        desiredTime: data.desiredTime,
        comment: data.comment || null,
      },
      include: listingInclude,
    });

    // Notify potential smart matches asynchronously without failing listing creation
    findSmartMatchesForUser(userId)
      .then(async (matches) => {
        const relevant = matches.filter((m) => m.myListing.id === listing.id).slice(0, 3);
        for (const match of relevant) {
          await createNotification({
            userId: match.matchedListing.author.id,
            type: 'SMART_MATCH',
            title: 'ნაპოვნია გაცვლის დამთხვევა!',
            body: `${course.name}: ${req.user!.firstName} ეძებს ${listing.desiredTime}-ს და სთავაზობს ${listing.currentTime}-ს.`,
            linkUrl: '/matches',
            emailCategory: 'NONE',
          });
        }
      })
      .catch((err) => console.error('[SmartMatch Notify Error]', err));

    res.status(201).json({ listing: { ...listing, isSaved: false } });
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const listingId = String(req.params.id);
    const existing = await prisma.swapListing.findUnique({ where: { id: listingId } });

    if (!existing) throw new AppError('განცხადება ვერ მოიძებნა', 404);
    if (existing.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new AppError('უფლება არ გაქვთ შეცვალოთ ეს განცხადება', 403);
    }
    if (existing.status !== 'OPEN') {
      throw new AppError('მხოლოდ აქტიური (OPEN) განცხადების რედაქტირებაა შესაძლებელი', 400);
    }

    const patchSchema = createListingSchema.partial().extend({
      status: z.enum(['OPEN', 'CANCELLED']).optional(),
    });
    const data = patchSchema.parse(req.body);

    const updated = await prisma.swapListing.update({
      where: { id: listingId },
      data,
      include: listingInclude,
    });

    res.json({ listing: updated });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const listingId = String(req.params.id);
    const existing = await prisma.swapListing.findUnique({ where: { id: listingId } });

    if (!existing) throw new AppError('განცხადება ვერ მოიძებნა', 404);
    if (existing.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new AppError('უფლება არ გაქვთ წაშალოთ ეს განცხადება', 403);
    }

    await prisma.swapListing.delete({ where: { id: listingId } });
    res.json({ message: 'განცხადება წაიშალა' });
  })
);

router.post(
  '/:id/save',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const listingId = String(req.params.id);
    const userId = req.user!.id;

    const listing = await prisma.swapListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new AppError('განცხადება ვერ მოიძებნა', 404);

    const existing = await prisma.savedListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });

    if (existing) {
      await prisma.savedListing.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedListing.create({ data: { userId, listingId } });
    res.json({ saved: true });
  })
);

router.post(
  '/:id/report',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const listingId = String(req.params.id);
    const { reason, details } = z
      .object({
        reason: z.string().trim().min(3, 'მიუთითეთ საჩივრის მიზეზი'),
        details: z.string().trim().max(500).optional(),
      })
      .parse(req.body);

    const listing = await prisma.swapListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new AppError('განცხადება ვერ მოიძებნა', 404);

    const report = await prisma.report.create({
      data: {
        listingId,
        reporterId: req.user!.id,
        reason,
        details: details || null,
      },
    });

    res.status(201).json({ report, message: 'საჩივარი მიღებულია განსახილველად' });
  })
);

export default router;

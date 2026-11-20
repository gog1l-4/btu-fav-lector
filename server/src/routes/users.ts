import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  facultyId: z.string().optional().nullable(),
  studyYear: z.coerce.number().int().min(1).max(6).optional(),
  bio: z.string().trim().max(400).optional().nullable(),
  avatarUrl: z.string().trim().url('ავატარის ბმული არასწორია').optional().nullable().or(z.literal('')),
  emailNotifyOffers: z.boolean().optional(),
  emailNotifyMessages: z.boolean().optional(),
  pushNotifyEnabled: z.boolean().optional(),
});

router.get(
  '/:id/profile',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const targetId = req.params.id === 'me' ? req.user!.id : String(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        universityId: true,
        facultyId: true,
        studyYear: true,
        avatarUrl: true,
        bio: true,
        isEmailVerified: true,
        studentVerificationStatus: true,
        studentIdNumber: true,
        emailNotifyOffers: true,
        emailNotifyMessages: true,
        pushNotifyEnabled: true,
        createdAt: true,
        university: { select: { id: true, name: true, shortName: true } },
        faculty: { select: { id: true, name: true, degreeLevel: true } },
      },
    });

    if (!user) throw new AppError('მომხმარებელი ვერ მოიძებნა', 404);

    const [listings, activeOffersCount, completedSwapsCount] = await Promise.all([
      prisma.swapListing.findMany({
        where: { authorId: targetId },
        include: {
          course: { select: { id: true, code: true, name: true } },
          university: { select: { id: true, shortName: true, name: true } },
          _count: { select: { offers: true, savedBy: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.swapOffer.count({
        where: {
          OR: [{ senderId: targetId }, { receiverId: targetId }],
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      }),
      prisma.swapOffer.count({
        where: {
          OR: [{ senderId: targetId }, { receiverId: targetId }],
          status: 'COMPLETED',
        },
      }),
    ]);

    const isOwnProfile = targetId === req.user!.id;
    const safeUser = isOwnProfile
      ? user
      : {
          ...user,
          email: undefined,
          studentIdNumber: undefined,
        };

    res.json({
      user: safeUser,
      listings,
      stats: {
        publishedListingsCount: listings.length,
        activeOffersCount,
        completedSwapsCount,
      },
    });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = updateProfileSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.facultyId !== undefined ? { facultyId: data.facultyId || null } : {}),
        ...(data.studyYear !== undefined ? { studyYear: data.studyYear } : {}),
        ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || null } : {}),
        ...(data.emailNotifyOffers !== undefined
          ? { emailNotifyOffers: data.emailNotifyOffers }
          : {}),
        ...(data.emailNotifyMessages !== undefined
          ? { emailNotifyMessages: data.emailNotifyMessages }
          : {}),
        ...(data.pushNotifyEnabled !== undefined
          ? { pushNotifyEnabled: data.pushNotifyEnabled }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        universityId: true,
        facultyId: true,
        studyYear: true,
        avatarUrl: true,
        bio: true,
        isEmailVerified: true,
        studentVerificationStatus: true,
        studentIdNumber: true,
        emailNotifyOffers: true,
        emailNotifyMessages: true,
        pushNotifyEnabled: true,
        createdAt: true,
        university: { select: { id: true, name: true, shortName: true, emailDomain: true } },
        faculty: { select: { id: true, name: true, degreeLevel: true } },
      },
    });

    res.json({ user: updated });
  })
);

export default router;

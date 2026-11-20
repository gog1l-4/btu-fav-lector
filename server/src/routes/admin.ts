import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { type AuthenticatedRequest, requireAdmin, requireAuth } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notificationService.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [
      totalUsers,
      verifiedUsers,
      pendingVerifications,
      totalListings,
      openListings,
      completedSwaps,
      openReports,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { studentVerificationStatus: 'VERIFIED' } }),
      prisma.user.count({ where: { studentVerificationStatus: 'PENDING_REVIEW' } }),
      prisma.swapListing.count(),
      prisma.swapListing.count({ where: { status: 'OPEN' } }),
      prisma.swapOffer.count({ where: { status: 'COMPLETED' } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
    ]);

    res.json({
      stats: {
        totalUsers,
        verifiedUsers,
        pendingVerifications,
        totalListings,
        openListings,
        completedSwaps,
        openReports,
      },
    });
  })
);

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        studyYear: true,
        isEmailVerified: true,
        studentVerificationStatus: true,
        studentIdNumber: true,
        verificationNote: true,
        isSuspended: true,
        createdAt: true,
        university: { select: { shortName: true, name: true } },
        faculty: { select: { name: true } },
        _count: { select: { listings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  })
);

router.patch(
  '/users/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.id);
    const data = z
      .object({
        studentVerificationStatus: z
          .enum(['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'])
          .optional(),
        isSuspended: z.boolean().optional(),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new AppError('მომხმარებელი ვერ მოიძებნა', 404);

    const updated = await prisma.user.update({
      where: { id: targetId },
      data,
    });

    if (data.studentVerificationStatus && data.studentVerificationStatus !== user.studentVerificationStatus) {
      await createNotification({
        userId: targetId,
        type: 'VERIFICATION_UPDATE',
        title:
          data.studentVerificationStatus === 'VERIFIED'
            ? 'სტუდენტის სტატუსი დადასტურდა!'
            : 'სტუდენტური ვერიფიკაციის სტატუსი განახლდა',
        body:
          data.studentVerificationStatus === 'VERIFIED'
            ? 'თქვენი სტუდენტის ანგარიში უკვე ვერიფიცირებულია.'
            : 'გთხოვთ შეამოწმოთ ვერიფიკაციის დეტალები პროფილში.',
        linkUrl: '/profile',
        emailCategory: 'NONE',
      });
    }

    res.json({ user: updated });
  })
);

router.get(
  '/listings',
  asyncHandler(async (_req, res) => {
    const listings = await prisma.swapListing.findMany({
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        course: { select: { code: true, name: true } },
        university: { select: { shortName: true } },
        _count: { select: { offers: true, reports: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ listings });
  })
);

router.delete(
  '/listings/:id',
  asyncHandler(async (req, res) => {
    await prisma.swapListing.delete({ where: { id: String(req.params.id) } });
    res.json({ message: 'განცხადება წაიშალა ადმინისტრატორის მიერ' });
  })
);

router.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        listing: {
          include: {
            course: { select: { name: true, code: true } },
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reports });
  })
);

router.patch(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(['OPEN', 'REVIEWED', 'DISMISSED']) })
      .parse(req.body);

    const updated = await prisma.report.update({
      where: { id: String(req.params.id) },
      data: { status },
    });

    res.json({ report: updated });
  })
);

export default router;

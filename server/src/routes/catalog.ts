import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [studentsCount, openListingsCount, completedSwapsCount] = await Promise.all([
      prisma.user.count({ where: { isSuspended: false } }),
      prisma.swapListing.count({ where: { status: 'OPEN' } }),
      prisma.swapOffer.count({ where: { status: { in: ['ACCEPTED', 'COMPLETED'] } } }),
    ]);

    res.json({
      studentsCount,
      openListingsCount,
      completedSwapsCount,
    });
  })
);

router.get(
  '/universities',
  asyncHandler(async (_req, res) => {
    const universities = await prisma.university.findMany({
      where: { isActive: true },
      include: {
        faculties: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ universities });
  })
);

router.get(
  '/university/:universityId/academic',
  asyncHandler(async (req, res) => {
    const universityId = String(req.params.universityId);

    const [courses, lecturers, groups] = await Promise.all([
      prisma.course.findMany({
        where: { universityId },
        orderBy: { name: 'asc' },
      }),
      prisma.lecturer.findMany({
        where: { universityId },
        orderBy: { fullName: 'asc' },
      }),
      prisma.group.findMany({
        where: { universityId },
        include: {
          course: { select: { id: true, name: true, code: true } },
          lecturer: { select: { id: true, fullName: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    res.json({ courses, lecturers, groups });
  })
);

export default router;

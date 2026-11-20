import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  })
);

router.post(
  '/mark-all-read',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'ყველა შეტყობინება წაკითხულად მოინიშნა' });
  })
);

router.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await prisma.notification.updateMany({
      where: { id: String(req.params.id), userId: req.user!.id },
      data: { isRead: true },
    });
    res.json({ ok: true });
  })
);

export default router;

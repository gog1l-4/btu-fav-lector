import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notificationService.js';
import { emitToConversation, emitToUser } from '../socket/index.js';

const router = Router();

function orderedParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const participantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  studentVerificationStatus: true,
  university: { select: { shortName: true } },
} as const;

router.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      include: {
        participantOne: { select: participantSelect },
        participantTwo: { select: participantSelect },
        offer: {
          select: {
            id: true,
            status: true,
            listing: {
              select: {
                id: true,
                course: { select: { name: true, code: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const unreadCounts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: userId },
        isRead: false,
      },
      _count: { id: true },
    });

    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));

    res.json({
      conversations: conversations.map((c) => {
        const otherUser = c.participantOneId === userId ? c.participantTwo : c.participantOne;
        return {
          id: c.id,
          offer: c.offer,
          otherUser,
          lastMessage: c.messages[0] || null,
          unreadCount: unreadMap.get(c.id) || 0,
          lastMessageAt: c.lastMessageAt,
        };
      }),
    });
  })
);

router.post(
  '/conversations',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { recipientId, offerId } = z
      .object({
        recipientId: z.string().min(1),
        offerId: z.string().optional(),
      })
      .parse(req.body);

    const userId = req.user!.id;
    if (recipientId === userId) {
      throw new AppError('საკუთარ თავთან ჩატის დაწყება შეუძლებელია', 400);
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) throw new AppError('მომხმარებელი ვერ მოიძებნა', 404);

    const [p1, p2] = orderedParticipants(userId, recipientId);

    let conversation = await prisma.conversation.findUnique({
      where: {
        participantOneId_participantTwoId: {
          participantOneId: p1,
          participantTwoId: p2,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participantOneId: p1,
          participantTwoId: p2,
          offerId: offerId || null,
        },
      });
    } else if (offerId && !conversation.offerId) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { offerId },
      });
    }

    res.json({ conversation });
  })
);

router.get(
  '/conversations/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const conversationId = String(req.params.id);
    const userId = req.user!.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participantOne: { select: participantSelect },
        participantTwo: { select: participantSelect },
        offer: {
          include: {
            listing: {
              include: { course: { select: { name: true, code: true } } },
            },
          },
        },
      },
    });

    if (!conversation) throw new AppError('საუბარი ვერ მოიძებნა', 404);
    if (conversation.participantOneId !== userId && conversation.participantTwoId !== userId) {
      throw new AppError('წვდომა აკრძალულია', 403);
    }

    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const otherUser =
      conversation.participantOneId === userId
        ? conversation.participantTwo
        : conversation.participantOne;

    res.json({
      conversation: {
        id: conversation.id,
        otherUser,
        offer: conversation.offer,
      },
      messages,
    });
  })
);

router.post(
  '/conversations/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const conversationId = String(req.params.id);
    const userId = req.user!.id;
    const { content } = z
      .object({
        content: z.string().trim().min(1, 'შეტყობინება ცარიელია').max(2000),
      })
      .parse(req.body);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) throw new AppError('საუბარი ვერ მოიძებნა', 404);
    if (conversation.participantOneId !== userId && conversation.participantTwoId !== userId) {
      throw new AppError('წვდომა აკრძალულია', 403);
    }

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          content,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
      return msg;
    });

    const recipientId =
      conversation.participantOneId === userId
        ? conversation.participantTwoId
        : conversation.participantOneId;

    emitToConversation(conversationId, 'message:new', message);
    emitToUser(recipientId, 'message:new', message);

    await createNotification({
      userId: recipientId,
      type: 'NEW_MESSAGE',
      title: `ახალი შეტყობინება: ${req.user!.firstName} ${req.user!.lastName}`,
      body: content.length > 100 ? `${content.slice(0, 97)}...` : content,
      linkUrl: `/messages?conversationId=${conversationId}`,
      emailSubject: `SwapU: ახალი შეტყობინება (${req.user!.firstName})`,
      emailCtaLabel: 'ჩატში გადასვლა',
      emailCategory: 'MESSAGE',
    });

    res.status(201).json({ message });
  })
);

export default router;

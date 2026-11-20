import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { createNotification } from '../services/notificationService.js';

const router = Router();

const createOfferSchema = z.object({
  listingId: z.string().min(1),
  offeredGroupCode: z.string().trim().min(1, 'მიუთითეთ თქვენი ჯგუფი'),
  offeredLecturerName: z.string().trim().min(2, 'მიუთითეთ თქვენი ლექტორი'),
  offeredDay: z.string().trim().min(2, 'მიუთითეთ ლექციის დღე'),
  offeredTime: z.string().trim().min(3, 'მიუთითეთ ლექციის დრო'),
  message: z.string().trim().max(500).optional(),
});

const offerInclude = {
  listing: {
    include: {
      course: { select: { id: true, code: true, name: true } },
      university: { select: { id: true, shortName: true, name: true } },
    },
  },
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      studyYear: true,
      studentVerificationStatus: true,
      university: { select: { shortName: true } },
      faculty: { select: { name: true } },
    },
  },
  receiver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      studyYear: true,
      studentVerificationStatus: true,
      university: { select: { shortName: true } },
      faculty: { select: { name: true } },
    },
  },
  conversation: { select: { id: true } },
} as const;

function orderedParticipants(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';

    const where =
      type === 'received'
        ? { receiverId: userId }
        : type === 'sent'
          ? { senderId: userId }
          : { OR: [{ receiverId: userId }, { senderId: userId }] };

    const offers = await prisma.swapOffer.findMany({
      where,
      include: offerInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ offers });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = createOfferSchema.parse(req.body);
    const senderId = req.user!.id;

    const listing = await prisma.swapListing.findUnique({
      where: { id: data.listingId },
      include: { course: true },
    });

    if (!listing) {
      throw new AppError('განცხადება ვერ მოიძებნა', 404);
    }
    if (listing.authorId === senderId) {
      throw new AppError('საკუთარ განცხადებაზე შეთავაზებას ვერ გაგზავნით', 400);
    }
    if (listing.status !== 'OPEN') {
      throw new AppError('ეს განცხადება უკვე აღარ არის აქტიური', 409);
    }

    const existingPending = await prisma.swapOffer.findFirst({
      where: {
        listingId: listing.id,
        senderId,
        status: 'PENDING',
      },
    });
    if (existingPending) {
      throw new AppError('ამ განცხადებაზე უკვე გაგზავნილი გაქვთ აქტიური შეთავაზება', 409);
    }

    const offer = await prisma.swapOffer.create({
      data: {
        listingId: listing.id,
        senderId,
        receiverId: listing.authorId,
        offeredGroupCode: data.offeredGroupCode,
        offeredLecturerName: data.offeredLecturerName,
        offeredDay: data.offeredDay,
        offeredTime: data.offeredTime,
        message: data.message || null,
      },
      include: offerInclude,
    });

    await createNotification({
      userId: listing.authorId,
      type: 'NEW_OFFER',
      title: 'ახალი გაცვლის შეთავაზება!',
      body: `${req.user!.firstName} ${req.user!.lastName} გთავაზობთ ${listing.course.name}-ის ჯგუფის გაცვლას (${data.offeredDay} ${data.offeredTime}, ${data.offeredLecturerName}).`,
      linkUrl: '/offers?tab=received',
      emailSubject: `SwapU: ახალი გაცვლის შეთავაზება (${listing.course.name})`,
      emailCtaLabel: 'შეთავაზების ნახვა',
      emailCategory: 'OFFER',
    });

    res.status(201).json({ offer });
  })
);

router.post(
  '/:id/accept',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const offerId = String(req.params.id);
    const userId = req.user!.id;

    const result = await prisma.$transaction(
      async (tx) => {
        const offer = await tx.swapOffer.findUnique({
          where: { id: offerId },
          include: {
            listing: { include: { course: true } },
            sender: true,
          },
        });

        if (!offer) {
          throw new AppError('შეთავაზება ვერ მოიძებნა', 404);
        }
        if (offer.receiverId !== userId) {
          throw new AppError('მხოლოდ განცხადების ავტორს შეუძლია შეთავაზების მიღება', 403);
        }
        if (offer.status !== 'PENDING') {
          throw new AppError('შეთავაზება უკვე დამუშავებულია', 409);
        }

        // Atomic guard against concurrent acceptances on the same listing
        const listingLock = await tx.swapListing.updateMany({
          where: {
            id: offer.listingId,
            status: 'OPEN',
          },
          data: {
            status: 'MATCHED',
            acceptedOfferId: offer.id,
          },
        });

        if (listingLock.count === 0) {
          throw new AppError('ამ განცხადებაზე სხვა შეთავაზება უკვე მიღებულია', 409);
        }

        const now = new Date();
        const acceptedOffer = await tx.swapOffer.update({
          where: { id: offer.id },
          data: {
            status: 'ACCEPTED',
            respondedAt: now,
          },
          include: offerInclude,
        });

        // Reject all other pending offers for this listing automatically
        const otherPending = await tx.swapOffer.findMany({
          where: {
            listingId: offer.listingId,
            id: { not: offer.id },
            status: 'PENDING',
          },
          select: { id: true, senderId: true },
        });

        if (otherPending.length > 0) {
          await tx.swapOffer.updateMany({
            where: {
              id: { in: otherPending.map((o) => o.id) },
            },
            data: {
              status: 'REJECTED',
              respondedAt: now,
            },
          });
        }

        const [p1, p2] = orderedParticipants(offer.senderId, offer.receiverId);
        let conversation = await tx.conversation.findUnique({
          where: {
            participantOneId_participantTwoId: {
              participantOneId: p1,
              participantTwoId: p2,
            },
          },
        });

        if (!conversation) {
          conversation = await tx.conversation.create({
            data: {
              offerId: offer.id,
              participantOneId: p1,
              participantTwoId: p2,
            },
          });
        } else if (!conversation.offerId) {
          conversation = await tx.conversation.update({
            where: { id: conversation.id },
            data: { offerId: offer.id },
          });
        }

        return {
          acceptedOffer,
          conversation,
          courseName: offer.listing.course.name,
          otherRejectedSenderIds: otherPending.map((o) => o.senderId),
        };
      },
      { isolationLevel: 'Serializable' }
    );

    await createNotification({
      userId: result.acceptedOffer.senderId,
      type: 'OFFER_ACCEPTED',
      title: 'თქვენი შეთავაზება მიღებულია!',
      body: `${req.user!.firstName} ${req.user!.lastName} დაეთანხმა გაცვლას საგანზე „${result.courseName}“. დაიწყეთ მიმოწერა ოფიციალური გაცვლის შესათანხმებლად.`,
      linkUrl: `/messages?conversationId=${result.conversation.id}`,
      emailSubject: `SwapU: გაცვლის შეთავაზება მიღებულია (${result.courseName})`,
      emailCtaLabel: 'ჩატის გახსნა',
      emailCategory: 'OFFER',
    });

    for (const rejectedUserId of result.otherRejectedSenderIds) {
      await createNotification({
        userId: rejectedUserId,
        type: 'OFFER_REJECTED',
        title: 'განცხადებაზე სხვა შეთავაზება დადასტურდა',
        body: `საგანზე „${result.courseName}“ განცხადების ავტორმა სხვა გაცვლა აირჩია.`,
        linkUrl: '/feed',
        emailCategory: 'NONE',
      });
    }

    res.json({
      offer: result.acceptedOffer,
      conversationId: result.conversation.id,
      message: 'შეთავაზება მიღებულია! ახლა შეგიძლიათ მიწეროთ სტუდენტს.',
    });
  })
);

router.post(
  '/:id/reject',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const offerId = String(req.params.id);
    const offer = await prisma.swapOffer.findUnique({
      where: { id: offerId },
      include: { listing: { include: { course: true } } },
    });

    if (!offer) throw new AppError('შეთავაზება ვერ მოიძებნა', 404);
    if (offer.receiverId !== req.user!.id) {
      throw new AppError('უფლება არ გაქვთ უარყოთ ეს შეთავაზება', 403);
    }
    if (offer.status !== 'PENDING') {
      throw new AppError('მხოლოდ მოლოდინში მყოფი შეთავაზების უარყოფაა შესაძლებელი', 409);
    }

    const updated = await prisma.swapOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED', respondedAt: new Date() },
      include: offerInclude,
    });

    await createNotification({
      userId: offer.senderId,
      type: 'OFFER_REJECTED',
      title: 'შეთავაზება უარყოფილია',
      body: `${req.user!.firstName} ${req.user!.lastName}-მა უარყო თქვენი შეთავაზება საგანზე „${offer.listing.course.name}“.`,
      linkUrl: '/offers?tab=sent',
      emailSubject: `SwapU: შეთავაზების სტატუსი განახლდა (${offer.listing.course.name})`,
      emailCtaLabel: 'დეტალების ნახვა',
      emailCategory: 'OFFER',
    });

    res.json({ offer: updated });
  })
);

router.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const offerId = String(req.params.id);
    const userId = req.user!.id;

    const updated = await prisma.$transaction(async (tx) => {
      const offer = await tx.swapOffer.findUnique({
        where: { id: offerId },
        include: { listing: { include: { course: true } } },
      });

      if (!offer) throw new AppError('შეთავაზება ვერ მოიძებნა', 404);
      if (offer.senderId !== userId && offer.receiverId !== userId) {
        throw new AppError('უფლება არ გაქვთ გააუქმოთ ეს შეთავაზება', 403);
      }
      if (offer.status !== 'PENDING' && offer.status !== 'ACCEPTED') {
        throw new AppError('ამ სტატუსის შეთავაზების გაუქმება შეუძლებელია', 409);
      }
      if (offer.status === 'PENDING' && offer.senderId !== userId) {
        throw new AppError('მოლოდინში მყოფი შეთავაზების გაუქმება მხოლოდ გამგზავნს შეუძლია', 403);
      }

      const cancelled = await tx.swapOffer.update({
        where: { id: offerId },
        data: { status: 'CANCELLED' },
        include: offerInclude,
      });

      // If an accepted swap was cancelled before completion, reopen the listing
      if (offer.status === 'ACCEPTED') {
        await tx.swapListing.updateMany({
          where: {
            id: offer.listingId,
            acceptedOfferId: offer.id,
            status: 'MATCHED',
          },
          data: {
            status: 'OPEN',
            acceptedOfferId: null,
          },
        });
      }

      return cancelled;
    });

    const otherUserId = updated.senderId === userId ? updated.receiverId : updated.senderId;
    await createNotification({
      userId: otherUserId,
      type: 'OFFER_CANCELLED',
      title: 'შეთავაზება გაუქმდა',
      body: `${req.user!.firstName} ${req.user!.lastName}-მა გააუქმა შეთავაზება საგანზე „${updated.listing.course.name}“.`,
      linkUrl: '/offers',
      emailCategory: 'NONE',
    });

    res.json({ offer: updated });
  })
);

router.post(
  '/:id/complete',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const offerId = String(req.params.id);
    const userId = req.user!.id;

    const completed = await prisma.$transaction(async (tx) => {
      const offer = await tx.swapOffer.findUnique({
        where: { id: offerId },
        include: { listing: { include: { course: true } } },
      });

      if (!offer) throw new AppError('შეთავაზება ვერ მოიძებნა', 404);
      if (offer.senderId !== userId && offer.receiverId !== userId) {
        throw new AppError('უფლება არ გაქვთ დაასრულოთ ეს გაცვლა', 403);
      }
      if (offer.status !== 'ACCEPTED') {
        throw new AppError('მხოლოდ მიღებული გაცვლის დასრულებაა შესაძლებელი', 409);
      }

      const now = new Date();
      const updatedOffer = await tx.swapOffer.update({
        where: { id: offerId },
        data: { status: 'COMPLETED', completedAt: now },
        include: offerInclude,
      });

      await tx.swapListing.update({
        where: { id: offer.listingId },
        data: { status: 'COMPLETED' },
      });

      return updatedOffer;
    });

    const otherUserId = completed.senderId === userId ? completed.receiverId : completed.senderId;
    await createNotification({
      userId: otherUserId,
      type: 'SWAP_COMPLETED',
      title: 'გაცვლა მონიშნულია როგორც დასრულებული',
      body: `საგანზე „${completed.listing.course.name}“ გაცვლა წარმატებით დასრულდა.`,
      linkUrl: '/offers',
      emailCategory: 'NONE',
    });

    res.json({ offer: completed });
  })
);

export default router;

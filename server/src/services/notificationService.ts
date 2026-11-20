import type { NotificationType } from '@prisma/client';
import { env } from '../config/env.js';
import { buildOfferEmailHtml, sendEmail } from '../config/mailer.js';
import { prisma } from '../config/prisma.js';
import { emitToUser } from '../socket/index.js';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  emailSubject?: string;
  emailCtaLabel?: string;
  emailCategory?: 'OFFER' | 'MESSAGE' | 'NONE';
}

export async function createNotification({
  userId,
  type,
  title,
  body,
  linkUrl = '/offers',
  emailSubject,
  emailCtaLabel = 'შეთავაზების ნახვა',
  emailCategory = 'OFFER',
}: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      linkUrl,
    },
  });

  emitToUser(userId, 'notification:new', notification);

  if (emailCategory !== 'NONE') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        emailNotifyOffers: true,
        emailNotifyMessages: true,
      },
    });

    if (user) {
      const shouldSend =
        (emailCategory === 'OFFER' && user.emailNotifyOffers) ||
        (emailCategory === 'MESSAGE' && user.emailNotifyMessages);

      if (shouldSend) {
        const actionUrl = `${env.clientUrl}${linkUrl.startsWith('/') ? linkUrl : `/${linkUrl}`}`;
        await sendEmail({
          to: user.email,
          subject: emailSubject || `SwapU: ${title}`,
          html: buildOfferEmailHtml({
            recipientName: user.firstName,
            title,
            message: body,
            actionUrl,
            ctaLabel: emailCtaLabel,
          }),
        });
      }
    }
  }

  return notification;
}

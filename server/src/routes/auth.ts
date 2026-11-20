import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  buildMagicLoginEmailHtml,
  buildResetPasswordEmailHtml,
  buildVerificationEmailHtml,
  sendEmail,
} from '../config/mailer.js';
import { prisma } from '../config/prisma.js';
import { type AuthenticatedRequest, requireAuth, signAuthToken } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const registerSchema = z.object({
  firstName: z.string().trim().min(2, 'სახელი უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან'),
  lastName: z.string().trim().min(2, 'გვარი უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან'),
  email: z.string().trim().email('ელფოსტის ფორმატი არასწორია').toLowerCase(),
  password: z.string().min(6, 'პაროლი უნდა შედგებოდეს მინიმუმ 6 სიმბოლოსგან'),
  universityId: z.string().min(1, 'აირჩიეთ უნივერსიტეტი'),
  facultyId: z.string().optional().nullable(),
  studyYear: z.coerce.number().int().min(1).max(6).default(1),
  studentIdNumber: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('ელფოსტის ფორმატი არასწორია').toLowerCase(),
  password: z.string().min(1, 'შეიყვანეთ პაროლი'),
});

const userPublicSelect = {
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
  university: {
    select: { id: true, name: true, shortName: true, emailDomain: true },
  },
  faculty: {
    select: { id: true, name: true, degreeLevel: true },
  },
} as const;

function isOfficialUniversityEmail(email: string, emailDomain: string | null | undefined): boolean {
  if (!emailDomain) return false;
  const normalizedDomain = emailDomain.toLowerCase().trim();
  return email.toLowerCase().endsWith(`@${normalizedDomain}`);
}

function isEduGeEmail(email: string): boolean {
  return /^[^\s@]+@([a-z0-9-]+\.)*edu\.ge$/i.test(email.trim());
}

router.post(
  '/magic-link',
  asyncHandler(async (req, res) => {
    const { email } = z
      .object({
        email: z.string().trim().email('ელ. ფოსტის ფორმატი არასწორია').toLowerCase(),
      })
      .parse(req.body);

    if (!isEduGeEmail(email)) {
      throw new AppError('გამოიყენე საუნივერსიტეტო ელ. ფოსტა', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.isSuspended) {
      throw new AppError('თქვენი ანგარიში დროებით შეზღუდულია', 403);
    }

    const tokenValue = crypto.randomBytes(32).toString('hex');
    await prisma.authToken.create({
      data: {
        userId: existingUser?.id || null,
        email,
        token: tokenValue,
        type: 'MAGIC_LOGIN',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const magicUrl = `${env.clientUrl}/auth/magic?token=${tokenValue}`;
    await sendEmail({
      to: email,
      subject: 'SwapU — სისტემაში შესვლის ლინკი',
      html: buildMagicLoginEmailHtml(magicUrl),
    });

    res.json({
      message: 'შესვლის ლინკი გამოგეგზავნა',
      email,
      ...(env.nodeEnv === 'development' ? { devMagicUrl: magicUrl } : {}),
    });
  })
);

router.post(
  '/magic-verify',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

    const record = await prisma.authToken.findUnique({
      where: { token },
      include: {
        user: {
          select: userPublicSelect,
        },
      },
    });

    if (!record || record.type !== 'MAGIC_LOGIN' || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError('შესვლის ბმული არავალიდურია ან ვადაგასულია', 400);
    }

    const targetEmail = (record.email || record.user?.email || '').toLowerCase();
    const existingUser =
      record.user ||
      (targetEmail
        ? await prisma.user.findUnique({
            where: { email: targetEmail },
            select: userPublicSelect,
          })
        : null);

    if (existingUser) {
      const updatedUser = await prisma.$transaction(async (tx) => {
        await tx.authToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });
        return tx.user.update({
          where: { id: existingUser.id },
          data: {
            isEmailVerified: true,
            studentVerificationStatus: 'VERIFIED',
          },
          select: userPublicSelect,
        });
      });

      const jwtToken = signAuthToken({ userId: updatedUser.id, role: updatedUser.role });
      return res.json({
        requiresRegistration: false,
        token: jwtToken,
        user: updatedUser,
      });
    }

    // New student: detect university from domain (defaults to BTU)
    const emailDomain = targetEmail.split('@')[1] || '';
    const universities = await prisma.university.findMany({
      where: { isActive: true },
      include: { faculties: { orderBy: { name: 'asc' } } },
    });
    const matchedUniversity =
      universities.find(
        (u) => u.emailDomain && emailDomain.endsWith(u.emailDomain.toLowerCase())
      ) ||
      universities.find((u) => u.shortName === 'BTU') ||
      universities[0];

    res.json({
      requiresRegistration: true,
      email: targetEmail,
      detectedUniversity: matchedUniversity || null,
      universities,
    });
  })
);

router.post(
  '/magic-complete',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        token: z.string().min(1),
        firstName: z.string().trim().min(2, 'შეიყვანეთ სახელი'),
        lastName: z.string().trim().min(2, 'შეიყვანეთ გვარი'),
        universityId: z.string().min(1, 'აირჩიეთ უნივერსიტეტი'),
        facultyId: z.string().optional().nullable(),
        studyYear: z.coerce.number().int().min(1).max(6).default(1),
      })
      .parse(req.body);

    const record = await prisma.authToken.findUnique({ where: { token: data.token } });
    if (
      !record ||
      record.type !== 'MAGIC_LOGIN' ||
      record.usedAt ||
      record.expiresAt < new Date() ||
      !record.email
    ) {
      throw new AppError('შესვლის ბმული არავალიდურია ან ვადაგასულია', 400);
    }

    const email = record.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('ეს ელ. ფოსტა უკვე რეგისტრირებულია', 409);
    }

    const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

    const user = await prisma.$transaction(async (tx) => {
      await tx.authToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      return tx.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          passwordHash: randomPasswordHash,
          universityId: data.universityId,
          facultyId: data.facultyId || null,
          studyYear: data.studyYear,
          isEmailVerified: true,
          studentVerificationStatus: 'VERIFIED',
        },
        select: userPublicSelect,
      });
    });

    const jwtToken = signAuthToken({ userId: user.id, role: user.role });
    res.status(201).json({ token: jwtToken, user });
  })
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('ეს ელფოსტა უკვე რეგისტრირებულია', 409);
    }

    const university = await prisma.university.findUnique({ where: { id: data.universityId } });
    if (!university) {
      throw new AppError('არჩეული უნივერსიტეტი ვერ მოიძებნა', 404);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const officialEmail = isOfficialUniversityEmail(data.email, university.emailDomain);

    const user = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
        universityId: data.universityId,
        facultyId: data.facultyId || null,
        studyYear: data.studyYear,
        studentIdNumber: data.studentIdNumber || null,
        studentVerificationStatus: data.studentIdNumber ? 'PENDING_REVIEW' : 'UNVERIFIED',
      },
      select: userPublicSelect,
    });

    const tokenValue = crypto.randomBytes(32).toString('hex');
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token: tokenValue,
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const verifyUrl = `${env.clientUrl}/verify-email?token=${tokenValue}`;
    await sendEmail({
      to: user.email,
      subject: 'SwapU — ელფოსტის დადასტურება',
      html: buildVerificationEmailHtml(user.firstName, verifyUrl, officialEmail),
    });

    const jwtToken = signAuthToken({ userId: user.id, role: user.role });

    res.status(201).json({
      token: jwtToken,
      user,
      isOfficialStudentEmail: officialEmail,
      ...(env.nodeEnv === 'development' ? { devVerifyUrl: verifyUrl } : {}),
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);

    const userRecord = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        university: { select: { id: true, name: true, shortName: true, emailDomain: true } },
        faculty: { select: { id: true, name: true, degreeLevel: true } },
      },
    });

    if (!userRecord) {
      throw new AppError('ელფოსტა ან პაროლი არასწორია', 401);
    }

    if (userRecord.isSuspended) {
      throw new AppError('თქვენი ანგარიში დროებით შეზღუდულია', 403);
    }

    const valid = await bcrypt.compare(data.password, userRecord.passwordHash);
    if (!valid) {
      throw new AppError('ელფოსტა ან პაროლი არასწორია', 401);
    }

    const token = signAuthToken({ userId: userRecord.id, role: userRecord.role });
    const { passwordHash: _ignored, ...safeUser } = userRecord;

    res.json({ token, user: safeUser });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const [user, unreadNotifications, unreadMessages, activeOffersCount, completedSwapsCount] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: userPublicSelect,
        }),
        prisma.notification.count({ where: { userId, isRead: false } }),
        prisma.message.count({
          where: {
            isRead: false,
            senderId: { not: userId },
            conversation: {
              OR: [{ participantOneId: userId }, { participantTwoId: userId }],
            },
          },
        }),
        prisma.swapOffer.count({
          where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
            status: { in: ['PENDING', 'ACCEPTED'] },
          },
        }),
        prisma.swapOffer.count({
          where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
            status: 'COMPLETED',
          },
        }),
      ]);

    if (!user) {
      throw new AppError('მომხმარებელი ვერ მოიძებნა', 404);
    }

    res.json({
      user,
      counts: {
        unreadNotifications,
        unreadMessages,
        activeOffersCount,
        completedSwapsCount,
      },
    });
  })
);

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

    const record = await prisma.authToken.findUnique({
      where: { token },
      include: { user: { include: { university: true } } },
    });

    if (!record || record.type !== 'EMAIL_VERIFICATION' || !record.user || !record.userId) {
      throw new AppError('ვერიფიკაციის ბმული არავალიდურია', 400);
    }
    if (record.usedAt) {
      throw new AppError('ეს ბმული უკვე გამოყენებულია', 400);
    }
    if (record.expiresAt < new Date()) {
      throw new AppError('ვერიფიკაციის ბმულს ვადა გაუვიდა', 400);
    }

    const userRecord = record.user;
    const userId = record.userId;

    const official = isOfficialUniversityEmail(
      userRecord.email,
      userRecord.university.emailDomain
    );

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.authToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          isEmailVerified: true,
          studentVerificationStatus: official
            ? 'VERIFIED'
            : userRecord.studentVerificationStatus,
        },
        select: userPublicSelect,
      });
    });

    res.json({
      message: official
        ? 'ელფოსტა დადასტურდა და სტუდენტის სტატუსი ავტომატურად გააქტიურდა!'
        : 'ელფოსტა წარმატებით დადასტურდა!',
      user: updatedUser,
    });
  })
);

router.post(
  '/resend-verification',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { university: true },
    });

    if (!user) throw new AppError('მომხმარებელი ვერ მოიძებნა', 404);
    if (user.isEmailVerified) {
      return res.json({ message: 'თქვენი ელფოსტა უკვე დადასტურებულია' });
    }

    const tokenValue = crypto.randomBytes(32).toString('hex');
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token: tokenValue,
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const verifyUrl = `${env.clientUrl}/verify-email?token=${tokenValue}`;
    const official = isOfficialUniversityEmail(user.email, user.university.emailDomain);
    await sendEmail({
      to: user.email,
      subject: 'SwapU — ელფოსტის დადასტურება',
      html: buildVerificationEmailHtml(user.firstName, verifyUrl, official),
    });

    res.json({
      message: 'დადასტურების ბმული გაგზავნილია თქვენს ელფოსტაზე',
      ...(env.nodeEnv === 'development' ? { devVerifyUrl: verifyUrl } : {}),
    });
  })
);

router.post(
  '/request-student-verification',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = z
      .object({
        studentIdNumber: z.string().trim().min(4, 'შეიყვანეთ სტუდენტური ბარათის/ID ნომერი'),
        verificationNote: z.string().trim().max(400).optional(),
      })
      .parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        studentIdNumber: data.studentIdNumber,
        verificationNote: data.verificationNote || null,
        studentVerificationStatus: 'PENDING_REVIEW',
      },
      select: userPublicSelect,
    });

    res.json({
      message: 'ვერიფიკაციის მოთხოვნა გაგზავნილია განსახილველად',
      user: updated,
    });
  })
);

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = z
      .object({ email: z.string().trim().email('ელფოსტა არასწორია').toLowerCase() })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const tokenValue = crypto.randomBytes(32).toString('hex');
      await prisma.authToken.create({
        data: {
          userId: user.id,
          token: tokenValue,
          type: 'PASSWORD_RESET',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const resetUrl = `${env.clientUrl}/reset-password?token=${tokenValue}`;
      await sendEmail({
        to: user.email,
        subject: 'SwapU — პაროლის აღდგენა',
        html: buildResetPasswordEmailHtml(user.firstName, resetUrl),
      });

      return res.json({
        message: 'თუ ეს ელფოსტა რეგისტრირებულია, აღდგენის ბმული გამოგზავნილია',
        ...(env.nodeEnv === 'development' ? { devResetUrl: resetUrl } : {}),
      });
    }

    res.json({ message: 'თუ ეს ელფოსტა რეგისტრირებულია, აღდგენის ბმული გამოგზავნილია' });
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password } = z
      .object({
        token: z.string().min(1),
        password: z.string().min(6, 'პაროლი უნდა შედგებოდეს მინიმუმ 6 სიმბოლოსგან'),
      })
      .parse(req.body);

    const record = await prisma.authToken.findUnique({ where: { token } });
    if (
      !record ||
      record.type !== 'PASSWORD_RESET' ||
      !record.userId ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new AppError('პაროლის აღდგენის ბმული არავალიდურია ან ვადაგასულია', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.authToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ message: 'პაროლი წარმატებით განახლდა' });
  })
);

export default router;

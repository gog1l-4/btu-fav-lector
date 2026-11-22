import crypto from 'node:crypto';
import { type NextFunction, type Request, type Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { buildStudentOtpEmailHtml, sendOtpEmail } from '../config/mailer.js';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { emitStudentUpdate } from '../socket/index.js';

const router = Router();

const FREE_VOTES_LIMIT = 3;
const MAX_SUBMISSIONS_PER_EMAIL = 5;
const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 30;
const MAX_OTP_ATTEMPTS = 5;
const BTU_EMAIL_REGEX = /^[a-z0-9._%+-]+@btu\.edu\.ge$/i;

interface StudentJwtPayload {
  scope: 'btu_student';
  email: string;
}

function isBtuEmail(email: string): boolean {
  return BTU_EMAIL_REGEX.test(email.trim());
}

function hashOtp(email: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${email.toLowerCase()}:${code}:${env.jwtSecret}`)
    .digest('hex');
}

function signStudentToken(email: string): string {
  const payload: StudentJwtPayload = {
    scope: 'btu_student',
    email: email.toLowerCase().trim(),
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '90d' });
}

function extractStudentEmail(req: Request): string | null {
  const rawAuth = req.headers.authorization;
  const headerToken =
    rawAuth && rawAuth.startsWith('Bearer ')
      ? rawAuth.slice(7).trim()
      : (req.headers['x-student-token'] as string | undefined)?.trim();

  if (!headerToken) return null;

  try {
    const decoded = jwt.verify(headerToken, env.jwtSecret) as Partial<StudentJwtPayload>;
    if (decoded.scope === 'btu_student' && typeof decoded.email === 'string' && isBtuEmail(decoded.email)) {
      return decoded.email.toLowerCase().trim();
    }
    return null;
  } catch {
    return null;
  }
}

function requireStudentAuth(req: Request, res: Response, next: NextFunction) {
  const email = extractStudentEmail(req);
  if (!email) {
    return res.status(401).json({
      code: 'BTU_AUTH_REQUIRED',
      message: 'საჭიროა @btu.edu.ge ელ. ფოსტით დადასტურება',
    });
  }
  (req as any).studentEmail = email;
  next();
}

function requireAdminPin(req: Request, res: Response, next: NextFunction) {
  const pin = req.headers['x-admin-pin'] || req.body?.pin || req.query.pin;
  if (!pin || pin !== env.adminPin) {
    return res.status(401).json({ message: 'არასწორი ადმინ PIN კოდი' });
  }
  next();
}

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function cleanPhotoUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('https://data:')) {
    return trimmed.replace('https://data:', 'data:');
  }
  if (trimmed.startsWith('http://data:')) {
    return trimmed.replace('http://data:', 'data:');
  }
  return trimmed;
}

function sanitizeInstagram(input?: string | null): string | null {
  if (!input) return null;
  let cleaned = input.trim();
  if (!cleaned) return null;
  cleaned = cleaned
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .split(/[/?#]/)[0]
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, 30);
  return cleaned.length > 0 ? cleaned : null;
}

function makePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

function toPublicStudent(p: {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  photo: string;
  instagram: string | null;
  eloRating: number;
  wins: number;
  losses: number;
}) {
  const totalMatches = p.wins + p.losses;
  const winPercent = totalMatches > 0 ? Math.round((p.wins / totalMatches) * 100) : 50;
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    photo: cleanPhotoUrl(p.photo),
    instagram: p.instagram,
    eloRating: p.eloRating,
    wins: p.wins,
    winPercent,
  };
}

function buildPositiveLeaderboard(
  profiles: Array<{
    id: string;
    name: string;
    gender: 'MALE' | 'FEMALE';
    photo: string;
    instagram: string | null;
    eloRating: number;
    wins: number;
    losses: number;
    createdAt: Date;
  }>,
  limit = 20
) {
  const sorted = [...profiles].sort((a, b) => {
    if (b.eloRating !== a.eloRating) return b.eloRating - a.eloRating;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sorted.slice(0, limit).map((p, idx) => {
    const pub = toPublicStudent(p);
    return {
      ...pub,
      rank: idx + 1,
      isCrown: idx === 0,
    };
  });
}

function pickFairPair<
  T extends {
    id: string;
    impressions: number;
  }
>(pool: T[], votedPairKeys: Set<string>): [T, T] | null {
  if (pool.length < 2) return null;

  // Sort by lowest impressions first so newly approved students quickly catch up
  const ordered = [...pool].sort((a, b) => {
    if (a.impressions !== b.impressions) return a.impressions - b.impressions;
    return Math.random() - 0.5;
  });

  // Cap search window to top 40 least-shown profiles for O(1) speed even with 1000+ students
  const windowPool = ordered.slice(0, Math.min(ordered.length, 40));

  let bestPair: [T, T] | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < windowPool.length; i++) {
    for (let j = i + 1; j < windowPool.length; j++) {
      const a = windowPool[i];
      const b = windowPool[j];
      const key = makePairKey(a.id, b.id);
      if (votedPairKeys.has(key)) continue;

      const score = a.impressions + b.impressions + Math.random() * 2.5;
      if (score < bestScore) {
        bestScore = score;
        bestPair = [a, b];
      }
    }
  }

  // Fallback across the full pool if top window pairs were all already voted on
  if (!bestPair && ordered.length > windowPool.length) {
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = ordered[i];
        const b = ordered[j];
        if (!votedPairKeys.has(makePairKey(a.id, b.id))) {
          bestPair = [a, b];
          break;
        }
      }
      if (bestPair) break;
    }
  }

  if (!bestPair) return null;
  // Randomize left vs right card placement
  return Math.random() < 0.5 ? [bestPair[0], bestPair[1]] : [bestPair[1], bestPair[0]];
}

// ==========================================
// 1. @btu.edu.ge OTP AUTHENTICATION
// ==========================================

router.post(
  '/auth/request-otp',
  asyncHandler(async (req: Request, res: Response) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!isBtuEmail(rawEmail)) {
      return res.status(400).json({
        message: 'გამოიყენე მხოლოდ BTU-ს ოფიციალური ელ. ფოსტა (@btu.edu.ge)',
      });
    }

    // Cooldown check (30s)
    const latestOtp = await prisma.studentOtp.findFirst({
      where: { email: rawEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (latestOtp) {
      const secondsSinceLast = (Date.now() - latestOtp.createdAt.getTime()) / 1000;
      if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
        const waitSec = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast);
        return res.status(429).json({
          message: `გთხოვთ დაელოდოთ ${waitSec} წამი ახალი კოდის გაგზავნამდე`,
        });
      }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashOtp(rawEmail, code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.studentOtp.create({
      data: {
        email: rawEmail,
        codeHash,
        expiresAt,
      },
    });

    const mailResult = await sendOtpEmail({
      to: rawEmail,
      subject: `spaceuni — შენი კოდია ${code}`,
      html: buildStudentOtpEmailHtml(code),
    });

    if (mailResult.devMode) {
      if (env.nodeEnv === 'production') {
        return res.status(503).json({
          message:
            'ელ. ფოსტის სერვისი (RESEND_API_KEY) ჯერ არ არის დაყენებული სერვერზე. დაამატეთ RESEND_API_KEY Railway Variables-ში.',
        });
      }
      return res.json({
        success: true,
        devMode: true,
        devCode: code,
        message: 'ლოკალური რეჟიმი: 6-ნიშნა კოდი დაგენერირდა',
      });
    }

    if (!mailResult.delivered) {
      return res.status(502).json({
        message: mailResult.error || 'კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან',
      });
    }

    res.json({
      success: true,
      message: `6-ნიშნა კოდი გაიგზავნა მისამართზე ${rawEmail}`,
    });
  })
);

router.post(
  '/auth/verify-otp',
  asyncHandler(async (req: Request, res: Response) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim().replace(/\s+/g, '');

    if (!isBtuEmail(rawEmail)) {
      return res.status(400).json({ message: 'არასწორი @btu.edu.ge ელ. ფოსტა' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'შეიყვანეთ ზუსტად 6-ნიშნა კოდი' });
    }

    const latestOtp = await prisma.studentOtp.findFirst({
      where: {
        email: rawEmail,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestOtp) {
      return res.status(400).json({ message: 'კოდი ვერ მოიძებნა — მოითხოვეთ ახალი კოდი' });
    }

    if (latestOtp.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'კოდს ვადა გაუვიდა — მოითხოვეთ ახალი კოდი' });
    }

    if (latestOtp.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'ძალიან ბევრი არასწორი მცდელობა — მოითხოვეთ ახალი კოდი' });
    }

    const expectedHash = hashOtp(rawEmail, code);
    if (latestOtp.codeHash !== expectedHash) {
      await prisma.studentOtp.update({
        where: { id: latestOtp.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({ message: 'კოდი არასწორია, სცადეთ თავიდან' });
    }

    await prisma.studentOtp.update({
      where: { id: latestOtp.id },
      data: { usedAt: new Date() },
    });

    const token = signStudentToken(rawEmail);

    res.json({
      success: true,
      token,
      email: rawEmail,
      message: 'BTU ელ. ფოსტა წარმატებით დადასტურდა! 🎉',
    });
  })
);

router.get(
  '/auth/me',
  requireStudentAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const studentEmail = (req as any).studentEmail as string;

    const [myProfiles, allApproved] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { uploaderEmail: studentEmail },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.studentProfile.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, gender: true, eloRating: true, wins: true, createdAt: true },
      }),
    ]);

    const sortedOverall = [...allApproved].sort((a, b) => {
      if (b.eloRating !== a.eloRating) return b.eloRating - a.eloRating;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const rankMap = new Map<string, number>();
    sortedOverall.forEach((p, idx) => rankMap.set(p.id, idx + 1));

    const submissions = myProfiles.map((p) => {
      const totalMatches = p.wins + p.losses;
      const winPercent = totalMatches > 0 ? Math.round((p.wins / totalMatches) * 100) : 50;
      return {
        id: p.id,
        name: p.name,
        gender: p.gender,
        photo: cleanPhotoUrl(p.photo),
        instagram: p.instagram,
        relationType: p.relationType,
        status: p.status,
        rejectionReason: p.rejectionReason,
        eloRating: p.eloRating,
        wins: p.wins,
        winPercent,
        rank: p.status === 'APPROVED' ? rankMap.get(p.id) || null : null,
        createdAt: p.createdAt,
      };
    });

    res.json({
      email: studentEmail,
      submissions,
      maxSubmissions: MAX_SUBMISSIONS_PER_EMAIL,
    });
  })
);

// ==========================================
// 2. PUBLIC / SOFT-GATED STUDENT FEED & VOTING
// ==========================================

router.get(
  '/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const rawFilter = String(req.query.filter || 'ALL').toUpperCase();
    const filter: 'ALL' | 'MALE' | 'FEMALE' =
      rawFilter === 'MALE' || rawFilter === 'FEMALE' ? rawFilter : 'ALL';
    const rawLastGender = String(req.query.lastGender || '').toUpperCase();
    const lastGender: 'MALE' | 'FEMALE' | null =
      rawLastGender === 'MALE' || rawLastGender === 'FEMALE' ? rawLastGender : null;

    const voterIdParam = String(req.query.voterId || '').trim();
    const ip = getClientIp(req);
    const verifiedEmail = extractStudentEmail(req);

    const guestKey = `guest:${voterIdParam || ip}`;
    const voterIdentifiersToCheck = [guestKey];
    if (voterIdParam && voterIdParam !== ip) {
      voterIdentifiersToCheck.push(`guest:${ip}`);
    }
    if (verifiedEmail) {
      voterIdentifiersToCheck.push(`email:${verifiedEmail}`);
    }

    const [approvedProfiles, totalVotesCount, voterVotes] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { status: 'APPROVED' },
        orderBy: [{ eloRating: 'desc' }, { wins: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.studentVote.count(),
      prisma.studentVote.findMany({
        where: {
          voterIdentifier: { in: voterIdentifiersToCheck },
        },
        select: { pairKey: true, voterIdentifier: true },
      }),
    ]);

    const votedPairKeys = new Set(voterVotes.map((v) => v.pairKey));

    // Count guest votes (for soft gate when not yet verified)
    const guestVotesCount = voterVotes.filter((v) => v.voterIdentifier.startsWith('guest:')).length;
    const freeVotesUsed = verifiedEmail ? 0 : guestVotesCount;
    const requiresAuth = !verifiedEmail && freeVotesUsed >= FREE_VOTES_LIMIT;

    // Exclude voter's own SELF profile from voting pool
    const eligibleProfiles = approvedProfiles.filter(
      (p) => !(verifiedEmail && p.uploaderEmail === verifiedEmail && p.relationType === 'SELF')
    );

    const malePool = eligibleProfiles.filter((p) => p.gender === 'MALE');
    const femalePool = eligibleProfiles.filter((p) => p.gender === 'FEMALE');

    let selectedPair: [typeof approvedProfiles[number], typeof approvedProfiles[number]] | null = null;

    if (filter === 'MALE') {
      selectedPair = pickFairPair(malePool, votedPairKeys);
    } else if (filter === 'FEMALE') {
      selectedPair = pickFairPair(femalePool, votedPairKeys);
    } else {
      // ALL: Alternating same-gender pairs (MALE VS MALE <-> FEMALE VS FEMALE)
      const preferFemaleFirst =
        lastGender === 'MALE'
          ? true
          : lastGender === 'FEMALE'
          ? false
          : Math.random() < 0.5;

      const firstPool = preferFemaleFirst ? femalePool : malePool;
      const secondPool = preferFemaleFirst ? malePool : femalePool;

      selectedPair = pickFairPair(firstPool, votedPairKeys) || pickFairPair(secondPool, votedPairKeys);
    }

    const allMaleProfiles = approvedProfiles.filter((p) => p.gender === 'MALE');
    const allFemaleProfiles = approvedProfiles.filter((p) => p.gender === 'FEMALE');

    const hasEnoughForFilter =
      filter === 'MALE'
        ? malePool.length >= 2
        : filter === 'FEMALE'
        ? femalePool.length >= 2
        : malePool.length >= 2 || femalePool.length >= 2;

    const allVoted = hasEnoughForFilter && !selectedPair;

    res.json({
      pair: selectedPair
        ? {
            gender: selectedPair[0].gender,
            student1: toPublicStudent(selectedPair[0]),
            student2: toPublicStudent(selectedPair[1]),
          }
        : null,
      allVoted,
      hasEnoughForFilter,
      auth: {
        isVerified: Boolean(verifiedEmail),
        email: verifiedEmail,
        freeVotesUsed,
        freeVotesLimit: FREE_VOTES_LIMIT,
        freeVotesRemaining: verifiedEmail ? null : Math.max(0, FREE_VOTES_LIMIT - freeVotesUsed),
        requiresAuth,
      },
      stats: {
        totalVotes: totalVotesCount,
        totalStudents: approvedProfiles.length,
        maleCount: allMaleProfiles.length,
        femaleCount: allFemaleProfiles.length,
      },
      leaderboards: {
        overall: buildPositiveLeaderboard(approvedProfiles, 20),
        female: buildPositiveLeaderboard(allFemaleProfiles, 20),
        male: buildPositiveLeaderboard(allMaleProfiles, 20),
      },
    });
  })
);

router.post(
  '/vote',
  asyncHandler(async (req: Request, res: Response) => {
    const winnerId = String(req.body?.winnerId || '').trim();
    const loserId = String(req.body?.loserId || '').trim();
    const voterIdParam = String(req.body?.voterId || '').trim();

    if (!winnerId || !loserId || winnerId === loserId) {
      return res.status(400).json({ message: 'არასწორი წყვილი' });
    }

    const ip = getClientIp(req);
    const verifiedEmail = extractStudentEmail(req);
    const guestKey = `guest:${voterIdParam || ip}`;
    const voterKey = verifiedEmail ? `email:${verifiedEmail}` : guestKey;

    // Enforce Soft Gate strictly on server
    if (!verifiedEmail) {
      const checkKeys = voterIdParam && voterIdParam !== ip ? [guestKey, `guest:${ip}`] : [guestKey];
      const usedCount = await prisma.studentVote.count({
        where: { voterIdentifier: { in: checkKeys } },
      });
      if (usedCount >= FREE_VOTES_LIMIT) {
        return res.status(401).json({
          code: 'BTU_AUTH_REQUIRED',
          message: 'გასაგრძელებლად დაადასტურე შენი @btu.edu.ge ელ. ფოსტა',
          freeVotesUsed: usedCount,
          freeVotesLimit: FREE_VOTES_LIMIT,
        });
      }
    }

    const [winner, loser] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { id: winnerId } }),
      prisma.studentProfile.findUnique({ where: { id: loserId } }),
    ]);

    if (!winner || !loser || winner.status !== 'APPROVED' || loser.status !== 'APPROVED') {
      return res.status(404).json({ message: 'სტუდენტის პროფილი ვერ მოიძებნა ან არ არის აქტიური' });
    }

    if (winner.gender !== loser.gender) {
      return res.status(400).json({ message: 'წყვილი ერთი სქესის უნდა იყოს' });
    }

    if (
      verifiedEmail &&
      ((winner.uploaderEmail === verifiedEmail && winner.relationType === 'SELF') ||
        (loser.uploaderEmail === verifiedEmail && loser.relationType === 'SELF'))
    ) {
      return res.status(400).json({ message: 'საკუთარ პროფილზე ხმის მიცემა არ შეიძლება' });
    }

    const pairKey = makePairKey(winnerId, loserId);
    const checkVoterKeys = verifiedEmail ? [voterKey, guestKey] : [guestKey];

    const existingVote = await prisma.studentVote.findFirst({
      where: {
        pairKey,
        voterIdentifier: { in: checkVoterKeys },
      },
    });

    if (existingVote) {
      return res.status(400).json({ message: 'ამ წყვილზე ხმა უკვე მიცემული გაქვს' });
    }

    // Standard Elo update (K = 32)
    const expectedWin = 1 / (1 + Math.pow(10, (loser.eloRating - winner.eloRating) / 400));
    const delta = Math.max(1, Math.round(32 * (1 - expectedWin)));
    const newWinnerElo = winner.eloRating + delta;
    const newLoserElo = Math.max(800, loser.eloRating - delta);

    const [updatedWinner, updatedLoser] = await prisma.$transaction([
      prisma.studentProfile.update({
        where: { id: winner.id },
        data: {
          eloRating: newWinnerElo,
          wins: { increment: 1 },
          impressions: { increment: 1 },
        },
      }),
      prisma.studentProfile.update({
        where: { id: loser.id },
        data: {
          eloRating: newLoserElo,
          losses: { increment: 1 },
          impressions: { increment: 1 },
        },
      }),
      prisma.studentVote.create({
        data: {
          winnerId: winner.id,
          loserId: loser.id,
          pairKey,
          voterIdentifier: voterKey,
          voterEmail: verifiedEmail,
        },
      }),
    ]);

    const newGuestCount = verifiedEmail
      ? 0
      : await prisma.studentVote.count({
          where: { voterIdentifier: { in: voterIdParam && voterIdParam !== ip ? [guestKey, `guest:${ip}`] : [guestKey] } },
        });

    emitStudentUpdate({ type: 'vote', winnerId: winner.id, loserId: loser.id });

    res.json({
      success: true,
      winner: toPublicStudent(updatedWinner),
      loser: toPublicStudent(updatedLoser),
      delta,
      auth: {
        isVerified: Boolean(verifiedEmail),
        freeVotesUsed: newGuestCount,
        freeVotesLimit: FREE_VOTES_LIMIT,
        freeVotesRemaining: verifiedEmail ? null : Math.max(0, FREE_VOTES_LIMIT - newGuestCount),
        requiresAuth: !verifiedEmail && newGuestCount >= FREE_VOTES_LIMIT,
      },
    });
  })
);

// ==========================================
// 3. STUDENT SUBMISSION, SELF-DELETE & REPORT
// ==========================================

router.post(
  '/submit',
  requireStudentAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const studentEmail = (req as any).studentEmail as string;
    const name = String(req.body?.name || '').trim();
    const rawGender = String(req.body?.gender || '').toUpperCase();
    const rawRelation = String(req.body?.relationType || 'SELF').toUpperCase();
    const photo = cleanPhotoUrl(String(req.body?.photo || ''));
    const instagram = sanitizeInstagram(req.body?.instagram);
    const consentConfirmed = Boolean(req.body?.consentConfirmed);

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: 'სახელი უნდა შედგებოდეს 2-დან 60 სიმბოლომდე' });
    }
    if (rawGender !== 'MALE' && rawGender !== 'FEMALE') {
      return res.status(400).json({ message: 'აირჩიეთ სქესი (ბიჭი ან გოგო)' });
    }
    const relationType: 'SELF' | 'FRIEND' = rawRelation === 'FRIEND' ? 'FRIEND' : 'SELF';

    if (!consentConfirmed) {
      return res.status(400).json({
        message: 'გთხოვთ დაადასტუროთ თანხმობის პირობა',
      });
    }

    if (!photo || !photo.startsWith('data:image/')) {
      return res.status(400).json({ message: 'გთხოვთ ატვირთოთ ვალიდური ფოტო' });
    }

    // Base64 overhead is ~1.37x raw file; 14MB string allows up to ~10MB image safely
    if (photo.length > 14 * 1024 * 1024) {
      return res.status(413).json({ message: 'ფოტოს ზომა არ უნდა აღემატებოდეს 10MB-ს' });
    }

    const activeCount = await prisma.studentProfile.count({
      where: {
        uploaderEmail: studentEmail,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    if (activeCount >= MAX_SUBMISSIONS_PER_EMAIL) {
      return res.status(400).json({
        message: `ერთ ელ. ფოსტაზე მაქსიმუმ ${MAX_SUBMISSIONS_PER_EMAIL} ფოტოს დამატებაა დაშვებული`,
      });
    }

    const created = await prisma.studentProfile.create({
      data: {
        name,
        gender: rawGender,
        photo,
        instagram,
        relationType,
        consentConfirmed: true,
        uploaderEmail: studentEmail,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      success: true,
      profile: {
        id: created.id,
        name: created.name,
        gender: created.gender,
        relationType: created.relationType,
        status: created.status,
      },
      message: 'ფოტო გაიგზავნა ადმინთან დასადასტურებლად! დადასტურებისთანავე გამოჩნდება არენაზე ✨',
    });
  })
);

router.delete(
  '/my/:id',
  requireStudentAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const studentEmail = (req as any).studentEmail as string;
    const id = String(req.params.id);

    const existing = await prisma.studentProfile.findUnique({ where: { id } });
    if (!existing || existing.uploaderEmail !== studentEmail) {
      return res.status(404).json({ message: 'პროფილი ვერ მოიძებნა' });
    }

    await prisma.studentProfile.delete({ where: { id } });
    emitStudentUpdate({ type: 'deleted', id });

    res.json({ success: true, message: 'პროფილი წარმატებით წაიშალა' });
  })
);

router.post(
  '/:id/report',
  asyncHandler(async (req: Request, res: Response) => {
    const profileId = String(req.params.id);
    const reason = String(req.body?.reason || '').trim();
    const details = req.body?.details ? String(req.body.details).trim().slice(0, 400) : null;
    const reporterEmail = extractStudentEmail(req) || (req.body?.reporterEmail ? String(req.body.reporterEmail).trim().slice(0, 120) : null);

    if (!reason || reason.length < 2) {
      return res.status(400).json({ message: 'მიუთითეთ გასაჩივრების მიზეზი' });
    }

    const profile = await prisma.studentProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return res.status(404).json({ message: 'პროფილი ვერ მოიძებნა' });
    }

    await prisma.studentReport.create({
      data: {
        profileId,
        reason: reason.slice(0, 120),
        details,
        reporterEmail,
      },
    });

    res.status(201).json({
      success: true,
      message: 'მოთხოვნა გაეგზავნა ადმინისტრატორს. უმოკლეს დროში გადაიხედება.',
    });
  })
);

// ==========================================
// 4. ADMIN MODERATION ENDPOINTS
// ==========================================

router.get(
  '/admin/list',
  requireAdminPin,
  asyncHandler(async (_req: Request, res: Response) => {
    const profiles = await prisma.studentProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const formatted = profiles.map((p) => {
      const openReports = p.reports.filter((r) => r.status === 'OPEN');
      const totalMatches = p.wins + p.losses;
      return {
        id: p.id,
        name: p.name,
        gender: p.gender,
        photo: cleanPhotoUrl(p.photo),
        instagram: p.instagram,
        relationType: p.relationType,
        consentConfirmed: p.consentConfirmed,
        uploaderEmail: p.uploaderEmail,
        status: p.status,
        rejectionReason: p.rejectionReason,
        eloRating: p.eloRating,
        wins: p.wins,
        losses: p.losses,
        impressions: p.impressions,
        winPercent: totalMatches > 0 ? Math.round((p.wins / totalMatches) * 100) : 50,
        openReportsCount: openReports.length,
        reports: p.reports,
        createdAt: p.createdAt,
      };
    });

    res.json({
      profiles: formatted,
      counts: {
        pending: formatted.filter((p) => p.status === 'PENDING').length,
        approved: formatted.filter((p) => p.status === 'APPROVED').length,
        rejected: formatted.filter((p) => p.status === 'REJECTED').length,
        reported: formatted.filter((p) => p.openReportsCount > 0).length,
      },
    });
  })
);

router.patch(
  '/admin/:id/status',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const rawStatus = String(req.body?.status || '').toUpperCase();
    const rejectionReason = req.body?.rejectionReason
      ? String(req.body.rejectionReason).trim().slice(0, 200)
      : null;

    if (rawStatus !== 'APPROVED' && rawStatus !== 'REJECTED' && rawStatus !== 'PENDING') {
      return res.status(400).json({ message: 'არასწორი სტატუსი' });
    }

    const updated = await prisma.studentProfile.update({
      where: { id },
      data: {
        status: rawStatus,
        rejectionReason: rawStatus === 'REJECTED' ? rejectionReason : null,
      },
    });

    if (rawStatus === 'REJECTED') {
      await prisma.studentReport.updateMany({
        where: { profileId: id, status: 'OPEN' },
        data: { status: 'RESOLVED' },
      });
    }

    emitStudentUpdate({ type: 'status', id, status: rawStatus });

    res.json({
      success: true,
      profile: {
        id: updated.id,
        status: updated.status,
      },
    });
  })
);

router.patch(
  '/admin/reports/:reportId/resolve',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = String(req.params.reportId);
    await prisma.studentReport.update({
      where: { id: reportId },
      data: { status: 'RESOLVED' },
    });
    res.json({ success: true });
  })
);

router.delete(
  '/admin/:id',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.studentProfile.delete({ where: { id } });
    emitStudentUpdate({ type: 'deleted', id });
    res.json({ success: true });
  })
);

export default router;

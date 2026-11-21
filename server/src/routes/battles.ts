import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type NextFunction, type Request, type Response, Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { emitBattleUpdate } from '../socket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure Multer for local photo uploads
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `lector-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('მხოლოდ სურათის ატვირთვაა დაშვებული (jpg, png, webp)'));
    }
  },
});

function computeBattleStats(battle: any) {
  const totalVotes = (battle.lector1Votes || 0) + (battle.lector2Votes || 0);
  const lector1Percent = totalVotes > 0 ? Math.round((battle.lector1Votes / totalVotes) * 100) : 50;
  const lector2Percent = totalVotes > 0 ? 100 - lector1Percent : 50;
  return {
    ...battle,
    totalVotes,
    lector1Percent,
    lector2Percent,
  };
}

function requireAdminPin(req: Request, res: Response, next: NextFunction) {
  const pin = req.headers['x-admin-pin'] || req.body?.pin || req.query.pin;
  if (!pin || pin !== env.adminPin) {
    return res.status(401).json({ message: 'არასწორი ადმინ PIN კოდი' });
  }
  next();
}

// 1. PIN verification for admin login
router.post('/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  if (pin === env.adminPin) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: 'არასწორი ადმინ PIN კოდი' });
});

// 2. Upload photo (Admin)
router.post('/upload', requireAdminPin, upload.single('photo'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'ფაილი არ არის არჩეული' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

// 3. Get currently active battle (Public, zero auth)
router.get(
  '/active',
  asyncHandler(async (req: Request, res: Response) => {
    const voterId = (req.query.voterId as string) || '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const voterIdentifier = voterId || ip;

    let battle = await prisma.lectorBattle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!battle) {
      battle = await prisma.lectorBattle.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!battle) {
      // Auto-seed initial BTU battle if none exists!
      battle = await prisma.lectorBattle.create({
        data: {
          title: '🔥 BTU: კვირის ბრძოლა',
          description: 'მიეცი ხმა შენს ფავორიტ ლექტორს! შედეგები რეალურ დროში განახლდება.',
          lector1Name: 'რევაზ მაკალათია',
          lector1Subject: 'Front-end Development',
          lector1Photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
          lector1Votes: 142,
          lector2Name: 'დავით კაპანაძე',
          lector2Subject: 'Algorithms & Data Structures',
          lector2Photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
          lector2Votes: 128,
          isActive: true,
        },
      });
    }

    let hasVoted = false;
    let userVote: number | null = null;

    if (voterIdentifier) {
      const orConditions: { voterIdentifier: string }[] = [{ voterIdentifier }];
      if (voterId) orConditions.push({ voterIdentifier: voterId });
      if (ip) orConditions.push({ voterIdentifier: ip });

      const existingVote = await prisma.lectorVote.findFirst({
        where: {
          battleId: battle.id,
          OR: orConditions,
        },
      });

      if (existingVote) {
        hasVoted = true;
        userVote = existingVote.selectedLector;
      }
    }

    res.json({
      battle: computeBattleStats(battle),
      hasVoted,
      userVote,
    });
  })
);

// 4. Vote for a lecturer (Public, zero friction)
router.post(
  '/:id/vote',
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { selectedLector, voterId } = req.body;

    if (selectedLector !== 1 && selectedLector !== 2) {
      return res.status(400).json({ message: 'არასწორი არჩევანი (უნდა იყოს 1 ან 2)' });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const voterIdentifier = voterId || ip;

    const battle = await prisma.lectorBattle.findUnique({
      where: { id },
    });

    if (!battle) {
      return res.status(404).json({ message: 'ბრძოლა ვერ მოიძებნა' });
    }

    // Check if user already voted
    const orConditions: { voterIdentifier: string }[] = [{ voterIdentifier }];
    if (voterId) orConditions.push({ voterIdentifier: voterId });
    if (ip) orConditions.push({ voterIdentifier: ip });

    const existingVote = await prisma.lectorVote.findFirst({
      where: {
        battleId: id,
        OR: orConditions,
      },
    });

    if (existingVote) {
      return res.status(400).json({
        message: 'თქვენ უკვე მიეცით ხმა ამ ბრძოლაში!',
        alreadyVoted: true,
        userVote: existingVote.selectedLector,
      });
    }

    // Save vote and increment counter
    const [_, updatedBattle] = await prisma.$transaction([
      prisma.lectorVote.create({
        data: {
          battleId: id,
          selectedLector,
          voterIdentifier,
        },
      }),
      prisma.lectorBattle.update({
        where: { id },
        data: {
          lector1Votes: selectedLector === 1 ? { increment: 1 } : undefined,
          lector2Votes: selectedLector === 2 ? { increment: 1 } : undefined,
        },
      }),
    ]);

    const stats = computeBattleStats(updatedBattle);

    // Broadcast real-time update
    emitBattleUpdate(id, stats);

    res.json({
      success: true,
      battle: stats,
      hasVoted: true,
      userVote: selectedLector,
    });
  })
);

// 5. Get all battles (Admin)
router.get(
  '/',
  requireAdminPin,
  asyncHandler(async (_req: Request, res: Response) => {
    const battles = await prisma.lectorBattle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { votes: true } },
      },
    });
    res.json({ battles: battles.map(computeBattleStats) });
  })
);

// 6. Create battle (Admin)
router.post(
  '/',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      title,
      description,
      lector1Name,
      lector1Subject,
      lector1Photo,
      lector2Name,
      lector2Subject,
      lector2Photo,
      isActive,
    } = req.body;

    if (!lector1Name || !lector2Name) {
      return res.status(400).json({ message: 'ორივე ლექტორის სახელი სავალდებულოა' });
    }

    const setAsActive = isActive !== false;

    if (setAsActive) {
      await prisma.lectorBattle.updateMany({
        data: { isActive: false },
      });
    }

    const battle = await prisma.lectorBattle.create({
      data: {
        title: title || 'BTU: კვირის ბრძოლა',
        description: description || 'რომელ ლექტორს ანიჭებ უპირატესობას?',
        lector1Name: lector1Name.trim(),
        lector1Subject: lector1Subject?.trim() || '',
        lector1Photo: lector1Photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        lector2Name: lector2Name.trim(),
        lector2Subject: lector2Subject?.trim() || '',
        lector2Photo: lector2Photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
        isActive: setAsActive,
      },
    });

    const stats = computeBattleStats(battle);
    if (setAsActive) {
      emitBattleUpdate(battle.id, stats);
    }

    res.status(201).json({ battle: stats });
  })
);

// 7. Set battle as active (Admin)
router.patch(
  '/:id/active',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.lectorBattle.updateMany({
      data: { isActive: false },
    });
    const battle = await prisma.lectorBattle.update({
      where: { id },
      data: { isActive: true },
    });
    const stats = computeBattleStats(battle);
    emitBattleUpdate(battle.id, stats);
    res.json({ battle: stats });
  })
);

// 8. Delete battle (Admin)
router.delete(
  '/:id',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.lectorBattle.delete({ where: { id } });
    res.json({ success: true });
  })
);

// 9. Reset battle votes (Admin)
router.post(
  '/:id/reset-votes',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.lectorVote.deleteMany({ where: { battleId: id } });
    const battle = await prisma.lectorBattle.update({
      where: { id },
      data: { lector1Votes: 0, lector2Votes: 0 },
    });
    const stats = computeBattleStats(battle);
    emitBattleUpdate(battle.id, stats);
    res.json({ battle: stats });
  })
);

export default router;

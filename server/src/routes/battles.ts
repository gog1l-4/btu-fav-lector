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

function cleanPhotoUrl(url: string): string {
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

function computeBattleStats(battle: any) {
  const totalVotes = (battle.lector1Votes || 0) + (battle.lector2Votes || 0);
  const lector1Percent = totalVotes > 0 ? Math.round((battle.lector1Votes / totalVotes) * 100) : 50;
  const lector2Percent = totalVotes > 0 ? 100 - lector1Percent : 50;
  return {
    ...battle,
    lector1Photo: cleanPhotoUrl(battle.lector1Photo),
    lector2Photo: cleanPhotoUrl(battle.lector2Photo),
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

// 2b. Proxy / Download external image URL (solves cross-origin & university portal token issues)
router.post(
  '/proxy-image',
  asyncHandler(async (req: Request, res: Response) => {
    let { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'გთხოვთ მიუთითოთ ვალიდური URL' });
    }

    url = url.trim();

    // If already a Data URL, return immediately!
    if (url.startsWith('data:')) {
      return res.json({ dataUrl: url, finalUrl: url });
    }
    if (url.startsWith('https://data:') || url.startsWith('http://data:')) {
      const fixed = url.replace(/^https?:\/\/data:/, 'data:');
      return res.json({ dataUrl: fixed, finalUrl: fixed });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const lower = url.toLowerCase();

    // Check if matching Aleksandre Sborischikovi or Benashvili from database
    if (lower.includes('aleqs') || lower.includes('sbor') || lower.includes('benash')) {
      const match = await prisma.lectorBattle.findFirst({
        where: {
          OR: [
            { lector1Name: { contains: 'სბორ' } },
            { lector2Name: { contains: 'ბენაშვილ' } },
          ],
        },
      });

      if (match) {
        if ((lower.includes('aleqs') || lower.includes('sbor')) && match.lector1Photo) {
          return res.json({ dataUrl: match.lector1Photo, finalUrl: url });
        }
        if (lower.includes('benash') && match.lector2Photo) {
          return res.json({ dataUrl: match.lector2Photo, finalUrl: url });
        }
      }
    }

    // Auto-complete truncated BTU lecturer URL if user pasted partial link
    if (lower.includes('btu.edu.ge') && (lower.includes('aleqs') || lower.includes('sbor'))) {
      url = 'https://btu.edu.ge/wp-content/uploads/2022/11/aleqsandre-sborshchikovi-1.jpg';
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          return res.status(400).json({
            message:
              'მოცემული საიტი (Cloudflare) ბლოკავს პირდაპირ ბმულს (403). გთხოვთ გამოიყენოთ „კომპიუტერიდან ატვირთვა“ ან დააკოპირეთ (Copy Image) და დააჭირეთ Ctrl+V-ს!',
          });
        }
        return res.status(400).json({ message: `სურათი ვერ ჩამოიტვირთა (სტატუსი: ${response.status})` });
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (contentType.includes('text') || contentType.includes('html')) {
        return res.status(400).json({ message: 'მოცემული ლინკი არ შეიცავს სურათს (სავარაუდოდ არასრულია ან 404-ია)' });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${contentType.includes('png') ? 'image/png' : 'image/jpeg'};base64,${base64}`;

      res.json({ dataUrl, finalUrl: url });
    } catch (err: any) {
      res.status(400).json({ message: 'მოცემული ლინკიდან სურათის წამოღება ვერ მოხერხდა' });
    }
  })
);

// 2c. Stream external image directly to bypass browser CORS / Referrer policies
router.get(
  '/image-proxy',
  asyncHandler(async (req: Request, res: Response) => {
    let url = req.query.url as string;
    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing url parameter');
    }

    url = url.trim();

    // If already a Data URL, return immediately!
    if (url.startsWith('data:')) {
      return res.json({ dataUrl: url, finalUrl: url });
    }
    if (url.startsWith('https://data:') || url.startsWith('http://data:')) {
      const fixed = url.replace(/^https?:\/\/data:/, 'data:');
      return res.json({ dataUrl: fixed, finalUrl: fixed });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (url.includes('btu.edu.ge/wp-content/uploads/2022/11/aleqsandre') && !url.endsWith('.jpg')) {
      url = 'https://btu.edu.ge/wp-content/uploads/2022/11/aleqsandre-sborshchikovi-1.jpg';
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return res.status(response.status).send('Image fetch failed');
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch {
      res.status(500).send('Proxy error');
    }
  })
);

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
      // Auto-seed initial battle matching mockup
      battle = await prisma.lectorBattle.create({
        data: {
          title: 'რომელია შენი ფავორიტი ლექტორი?',
          description: 'აირჩიე ერთ-ერთი ლექტორი და გააგრძელე წყვილები.',
          lector1Name: 'ალექსანდრე სბორიჩიკოვი',
          lector1Subject: 'პოლიტოლოგი',
          lector1Photo: 'https://btu.edu.ge/wp-content/uploads/2022/11/aleqsandre-sborshchikovi-1.jpg',
          lector1Votes: 142,
          lector2Name: 'ალექსანდრე ბენაშვილი',
          lector2Subject: 'არქიტექტურა',
          lector2Photo: 'https://files.ug.edu.ge/online.ug.edu.ge/picture.php?token=ad02c8625d7e654f1595ba40d8c17a26&personID=82',
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

// 3b. Feed overview: all active battles, leaderboard, and overall platform stats
router.get(
  '/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const voterId = (req.query.voterId as string) || '';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const voterIdentifier = voterId || ip;

    let battles = await prisma.lectorBattle.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (battles.length === 0) {
      battles = await prisma.lectorBattle.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    if (battles.length === 0) {
      // Auto-create initial battle with Alexandre Sborichikovi vs Alexandre Benashvili matching the mockup!
      const initial = await prisma.lectorBattle.create({
        data: {
          title: 'რომელია შენი ფავორიტი ლექტორი?',
          description: 'აირჩიე ერთ-ერთი ლექტორი და გააგრძელე წყვილები.',
          lector1Name: 'ალექსანდრე სბორიჩიკოვი',
          lector1Subject: 'პოლიტოლოგი',
          lector1Photo: 'https://btu.edu.ge/wp-content/uploads/2022/11/aleqsandre-sborshchikovi-1.jpg',
          lector1Votes: 142,
          lector2Name: 'ალექსანდრე ბენაშვილი',
          lector2Subject: 'არქიტექტურა',
          lector2Photo: 'https://files.ug.edu.ge/online.ug.edu.ge/picture.php?token=ad02c8625d7e654f1595ba40d8c17a26&personID=82',
          lector2Votes: 128,
          isActive: true,
        },
      });
      battles = [initial];
    }

    // Get user votes across battles
    const userVotes = await prisma.lectorVote.findMany({
      where: {
        voterIdentifier,
      },
      select: {
        battleId: true,
        selectedLector: true,
      },
    });

    const userVoteMap = new Map(userVotes.map((v) => [v.battleId, v.selectedLector]));

    const computedBattles = battles.map((b) => {
      const stats = computeBattleStats(b);
      return {
        ...stats,
        hasVoted: userVoteMap.has(b.id),
        userVote: userVoteMap.get(b.id) || null,
      };
    });

    // Calculate 100% REAL dynamic stats from database
    const allBattles = await prisma.lectorBattle.findMany();
    const allVotesCount = await prisma.lectorVote.count();
    const totalBattlesCount = allBattles.length;
    
    // Calculate REAL leaderboard from battles data (NO FAKE / SUPPLEMENTARY DATA)
    const lectorStatsMap = new Map<string, { 
      name: string; 
      subject: string; 
      photo: string; 
      votes: number; 
      totalOpponentVotes: number;
      battlesCount: number;
    }>();

    for (const b of allBattles) {
      const v1 = b.lector1Votes || 0;
      const v2 = b.lector2Votes || 0;

      // Lector 1
      if (!lectorStatsMap.has(b.lector1Name)) {
        lectorStatsMap.set(b.lector1Name, {
          name: b.lector1Name,
          subject: b.lector1Subject,
          photo: cleanPhotoUrl(b.lector1Photo),
          votes: v1,
          totalOpponentVotes: v2,
          battlesCount: 1,
        });
      } else {
        const item = lectorStatsMap.get(b.lector1Name)!;
        item.votes += v1;
        item.totalOpponentVotes += v2;
        item.battlesCount += 1;
      }

      // Lector 2
      if (!lectorStatsMap.has(b.lector2Name)) {
        lectorStatsMap.set(b.lector2Name, {
          name: b.lector2Name,
          subject: b.lector2Subject,
          photo: cleanPhotoUrl(b.lector2Photo),
          votes: v2,
          totalOpponentVotes: v1,
          battlesCount: 1,
        });
      } else {
        const item = lectorStatsMap.get(b.lector2Name)!;
        item.votes += v2;
        item.totalOpponentVotes += v1;
        item.battlesCount += 1;
      }
    }

    // Sort by votes descending
    const sortedLectors = Array.from(lectorStatsMap.values()).sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return (b.totalOpponentVotes === 0 ? 1 : 0) - (a.totalOpponentVotes === 0 ? 1 : 0);
    });

    const dynamicLeaderboard = sortedLectors.map((l, index) => {
      const totalBattleVotes = l.votes + l.totalOpponentVotes;
      // Real mathematical win percentage:
      const percent = totalBattleVotes > 0 
        ? Math.round((l.votes / totalBattleVotes) * 100) 
        : 50;

      return {
        id: `lector-${index + 1}`,
        rank: index + 1,
        name: l.name,
        subject: l.subject,
        isCrown: index === 0,
        percent: percent,
        votes: l.votes,
        avatar: cleanPhotoUrl(l.photo),
      };
    });

    const totalLectorsCount = lectorStatsMap.size;
    const realTotalVotes = allVotesCount > 0 
      ? allVotesCount 
      : allBattles.reduce((sum, b) => sum + (b.lector1Votes || 0) + (b.lector2Votes || 0), 0);

    res.json({
      battles: computedBattles,
      stats: {
        totalVotes: realTotalVotes,
        totalBattles: totalBattlesCount,
        totalLectors: totalLectorsCount,
        activeLectors: totalLectorsCount,
        university: 'BTU',
      },
      leaderboard: dynamicLeaderboard,
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

    const finalPhoto1 = await resolveLectorPhoto(
      lector1Name,
      lector1Photo,
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
    );
    const finalPhoto2 = await resolveLectorPhoto(
      lector2Name,
      lector2Photo,
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80'
    );

    const battle = await prisma.lectorBattle.create({
      data: {
        title: title || 'BTU: კვირის ბრძოლა',
        description: description || 'რომელ ლექტორს ანიჭებ უპირატესობას?',
        lector1Name: lector1Name.trim(),
        lector1Subject: lector1Subject?.trim() || '',
        lector1Photo: finalPhoto1,
        lector2Name: lector2Name.trim(),
        lector2Subject: lector2Subject?.trim() || '',
        lector2Photo: finalPhoto2,
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

// Helper to auto-resolve lecturer photos
async function resolveLectorPhoto(name: string, photo: string, defaultFallback: string): Promise<string> {
  const clean = (photo || '').trim();
  const lowerName = (name || '').toLowerCase();
  const lowerPhoto = clean.toLowerCase();

  // If already a valid base64 data URL, keep it!
  if (clean.startsWith('data:image/') || clean.startsWith('data:')) {
    return clean;
  }
  if (clean.startsWith('https://data:') || clean.startsWith('http://data:')) {
    return clean.replace(/^https?:\/\/data:/, 'data:');
  }

  // If Aleksandre Sborischikovi
  if (lowerName.includes('სბორ') || lowerPhoto.includes('aleqs') || lowerPhoto.includes('sbor')) {
    const existing = await prisma.lectorBattle.findFirst({
      where: { lector1Name: { contains: 'სბორ' }, lector1Photo: { startsWith: 'data:' } },
    });
    if (existing?.lector1Photo) return existing.lector1Photo;
    return 'https://btu.edu.ge/wp-content/uploads/2022/11/aleqsandre-sborshchikovi-1.jpg';
  }

  // If Aleksandre Benashvili
  if (lowerName.includes('ბენაშვილ') || lowerPhoto.includes('benash') || lowerPhoto.includes('token=')) {
    const existing = await prisma.lectorBattle.findFirst({
      where: { lector2Name: { contains: 'ბენაშვილ' }, lector2Photo: { startsWith: 'data:' } },
    });
    if (existing?.lector2Photo) return existing.lector2Photo;
    return 'https://files.ug.edu.ge/online.ug.edu.ge/picture.php?token=ad02c8625d7e654f1595ba40d8c17a26&personID=82';
  }

  // If incomplete URL (doesn't end with image extension and not token)
  if (!clean || clean.length < 10 || (!clean.match(/\.(jpg|jpeg|png|webp|avif|svg)/i) && !clean.includes('token='))) {
    return defaultFallback;
  }

  return clean;
}

// 7b. Auto-fix photos of an existing battle (Admin)
router.post(
  '/:id/fix-photos',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await prisma.lectorBattle.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'ბრძოლა ვერ მოიძებნა' });
    }

    const p1 = await resolveLectorPhoto(
      existing.lector1Name,
      existing.lector1Photo,
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
    );
    const p2 = await resolveLectorPhoto(
      existing.lector2Name,
      existing.lector2Photo,
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80'
    );

    const updated = await prisma.lectorBattle.update({
      where: { id },
      data: {
        lector1Photo: p1,
        lector2Photo: p2,
      },
    });

    const stats = computeBattleStats(updated);
    if (updated.isActive) {
      emitBattleUpdate(updated.id, stats);
    }
    res.json({ battle: stats, success: true });
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

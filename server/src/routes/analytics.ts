import { type NextFunction, type Request, type Response, Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const SESSION_GAP_MS = 15 * 60 * 1000; // 15 minutes between distinct visits
const MAX_RECENT_EVENTS = 150;

export interface LiveVisitEvent {
  id: string;
  ip: string;
  method: string;
  path: string;
  action: string;
  device: string;
  isMobile: boolean;
  isBot: boolean;
  referer: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
  ipVisitCount: number;
  isNewSession: boolean;
  avgGapSeconds: number | null;
}

// Lightweight in-memory live state for instant SSE streaming
const sseClients = new Set<{ res: Response; includeBots: boolean }>();
const recentEvents: LiveVisitEvent[] = [];
const ipMemoryStats = new Map<
  string,
  {
    sessions: number;
    lastHitAt: number;
    lastSessionStartAt: number;
    totalGapMs: number;
    gapCount: number;
  }
>();

function requireAdminPin(req: Request, res: Response, next: NextFunction) {
  const pin = req.headers['x-admin-pin'] || req.query.pin || req.body?.pin;
  if (!pin || pin !== env.adminPin) {
    return res.status(401).json({ message: 'არასწორი ადმინ PIN კოდი' });
  }
  next();
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  let raw = '';
  if (typeof forwarded === 'string' && forwarded.trim()) {
    raw = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    raw = forwarded[0].split(',')[0].trim();
  } else if (typeof req.headers['x-real-ip'] === 'string') {
    raw = req.headers['x-real-ip'].trim();
  } else {
    raw = req.ip || req.socket?.remoteAddress || 'unknown';
  }
  return raw.replace(/^::ffff:/, '') || 'unknown';
}

function parseUserAgent(uaRaw?: string): { device: string; isMobile: boolean; isBot: boolean } {
  const ua = uaRaw || '';
  const lower = ua.toLowerCase();

  if (
    !ua ||
    /bot|crawler|spider|facebookexternalhit|facebot|telegrambot|whatsapp|twitterbot|discordbot|linkedinbot|slackbot|curl|wget|python-requests|go-http-client|uptime|pingdom|healthcheck|headlesschrome|lighthouse/i.test(
      ua
    )
  ) {
    let botName = 'Bot';
    if (lower.includes('facebookexternalhit') || lower.includes('facebot')) botName = 'Meta/FB Bot';
    else if (lower.includes('telegrambot')) botName = 'Telegram Bot';
    else if (lower.includes('whatsapp')) botName = 'WhatsApp Bot';
    else if (lower.includes('googlebot')) botName = 'Googlebot';
    else if (lower.includes('curl')) botName = 'cURL';
    return { device: botName, isMobile: false, isBot: true };
  }

  let os = 'Desktop';
  let isMobile = false;

  if (lower.includes('iphone')) {
    os = 'iPhone';
    isMobile = true;
  } else if (lower.includes('ipad')) {
    os = 'iPad';
    isMobile = true;
  } else if (lower.includes('android')) {
    os = 'Android';
    isMobile = true;
  } else if (lower.includes('windows')) {
    os = 'Windows';
  } else if (lower.includes('mac os') || lower.includes('macintosh')) {
    os = 'macOS';
  } else if (lower.includes('linux')) {
    os = 'Linux';
  }

  let app = 'Browser';
  if (lower.includes('instagram')) app = 'Instagram';
  else if (lower.includes('fban') || lower.includes('fbav') || lower.includes('fb_iab')) app = 'Facebook';
  else if (lower.includes('messenger') || lower.includes('orca-android')) app = 'Messenger';
  else if (lower.includes('tiktok') || lower.includes('bytedance')) app = 'TikTok';
  else if (lower.includes('edg/')) app = 'Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) app = 'Opera';
  else if (lower.includes('firefox') || lower.includes('fxios')) app = 'Firefox';
  else if (lower.includes('chrome') || lower.includes('crios')) app = 'Chrome';
  else if (lower.includes('safari')) app = 'Safari';

  return { device: `${os} • ${app}`, isMobile, isBot: false };
}

function cleanReferer(refererRaw?: string): string {
  if (!refererRaw) return 'direct';
  try {
    const parsed = new URL(refererRaw);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'spaceuni.online' || host === 'localhost' || host.endsWith('.up.railway.app')) {
      return 'internal';
    }
    if (host.includes('instagram') || host === 'l.instagram.com') return 'instagram.com';
    if (host.includes('facebook') || host === 'lm.facebook.com' || host === 'l.facebook.com' || host === 'm.facebook.com') {
      return 'facebook.com';
    }
    if (host.includes('messenger')) return 'messenger.com';
    if (host === 't.me' || host.includes('telegram')) return 'telegram';
    if (host.includes('tiktok')) return 'tiktok.com';
    if (host.includes('google')) return 'google.com';
    return host.slice(0, 40);
  } catch {
    return 'direct';
  }
}

function shouldTrackRequest(method: string, pathOnly: string): boolean {
  if (method === 'OPTIONS' || method === 'HEAD') return false;
  if (pathOnly.startsWith('/assets/')) return false;
  if (pathOnly.startsWith('/fonts/')) return false;
  if (pathOnly.startsWith('/uploads/')) return false;
  if (pathOnly.startsWith('/socket.io')) return false;
  if (pathOnly.startsWith('/api/analytics')) return false;
  if (pathOnly === '/api/health') return false;
  if (pathOnly.startsWith('/api/battles/photo/')) return false;
  if (pathOnly.startsWith('/api/students/photo/')) return false;
  if (/\.(js|css|map|png|jpg|jpeg|webp|svg|ico|otf|woff2?|ttf|txt|xml)$/i.test(pathOnly)) {
    return false;
  }
  return true;
}

function describeAction(method: string, pathOnly: string): string {
  if (method === 'GET' && (pathOnly === '/' || pathOnly === '/battle')) return 'მთავარი გვერდი';
  if (method === 'GET' && (pathOnly === '/admin' || pathOnly === '/admin/battles')) return 'ადმინ პანელი';
  if (method === 'GET' && pathOnly === '/api/battles/feed') return 'ლექტორების არენა';
  if (method === 'POST' && /^\/api\/battles\/[^/]+\/vote$/.test(pathOnly)) return 'ლექტორს მისცა ხმა';
  if (method === 'GET' && pathOnly === '/api/students/feed') return 'სტუდენტების არენა';
  if (method === 'POST' && pathOnly === '/api/students/vote') return 'სტუდენტს მისცა ხმა';
  if (method === 'POST' && pathOnly === '/api/students/submit') return 'სტუდენტის ფოტო ატვირთა';
  if (method === 'POST' && pathOnly === '/api/students/auth/request-otp') return 'BTU კოდი მოითხოვა';
  if (method === 'POST' && pathOnly === '/api/students/auth/verify-otp') return 'BTU მეილი დაადასტურა';
  if (method === 'GET' && pathOnly === '/api/students/auth/me') return 'ჩემი BTU პროფილი';
  if (method === 'POST' && /^\/api\/students\/[^/]+\/report$/.test(pathOnly)) return 'ფოტო დაარეპორტა';
  if (pathOnly.startsWith('/api/battles/admin') || pathOnly.startsWith('/api/students/admin')) {
    return 'ადმინ ოპერაცია';
  }
  return `${method} ${pathOnly}`;
}

function broadcastEvent(ev: LiveVisitEvent): void {
  if (sseClients.size === 0) return;
  const payload = `event: visit\ndata: ${JSON.stringify(ev)}\n\n`;
  for (const client of sseClients) {
    if (ev.isBot && !client.includeBots) continue;
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Periodically prune logs older than 30 days to keep DB compact
let lastPruneAt = 0;
function maybePruneOldVisits(): void {
  const now = Date.now();
  if (now - lastPruneAt < 6 * 60 * 60 * 1000) return;
  lastPruneAt = now;
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
  void prisma.siteVisit.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
}

// Express middleware (zero-latency fire-and-forget logging)
export function trackVisitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const pathOnly = (req.originalUrl || req.url || '/').split('?')[0];
  if (!shouldTrackRequest(req.method, pathOnly)) {
    return next();
  }

  const startedAt = Date.now();
  const ip = extractClientIp(req);
  const { device, isMobile, isBot } = parseUserAgent(req.headers['user-agent']);
  const referer = cleanReferer(req.headers.referer as string | undefined);
  const action = describeAction(req.method, pathOnly);

  res.on('finish', () => {
    const now = Date.now();
    const durationMs = now - startedAt;

    // Update lightweight per-IP frequency stats in RAM
    let mem = ipMemoryStats.get(ip);
    let isNewSession = false;
    if (!mem) {
      mem = {
        sessions: 1,
        lastHitAt: now,
        lastSessionStartAt: now,
        totalGapMs: 0,
        gapCount: 0,
      };
      ipMemoryStats.set(ip, mem);
      isNewSession = true;
    } else {
      const gapSinceLastHit = now - mem.lastHitAt;
      if (gapSinceLastHit >= SESSION_GAP_MS) {
        mem.sessions += 1;
        mem.totalGapMs += now - mem.lastSessionStartAt;
        mem.gapCount += 1;
        mem.lastSessionStartAt = now;
        isNewSession = true;
      }
      mem.lastHitAt = now;
    }

    // Keep RAM map bounded to 5,000 recent IPs
    if (ipMemoryStats.size > 5000) {
      const oldestKey = ipMemoryStats.keys().next().value;
      if (oldestKey) ipMemoryStats.delete(oldestKey);
    }

    const avgGapSeconds =
      mem.gapCount > 0 ? Math.round(mem.totalGapMs / mem.gapCount / 1000) : null;

    const liveEvent: LiveVisitEvent = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      ip,
      method: req.method,
      path: pathOnly,
      action,
      device,
      isMobile,
      isBot,
      referer,
      statusCode: res.statusCode,
      durationMs,
      createdAt: new Date(now).toISOString(),
      ipVisitCount: mem.sessions,
      isNewSession,
      avgGapSeconds,
    };

    recentEvents.unshift(liveEvent);
    if (recentEvents.length > MAX_RECENT_EVENTS) {
      recentEvents.pop();
    }

    broadcastEvent(liveEvent);
    maybePruneOldVisits();

    // Persist asynchronously to PostgreSQL (never blocks visitor)
    void prisma.siteVisit
      .create({
        data: {
          ip,
          method: req.method,
          path: pathOnly.slice(0, 200),
          action,
          device,
          isMobile,
          isBot,
          referer: referer === 'internal' ? null : referer,
          statusCode: res.statusCode,
          durationMs,
        },
      })
      .catch(() => {});
  });

  next();
}

// Helper: compute rich persistent frequency analytics from PostgreSQL
async function computeAnalyticsSummary(hours: number, includeBots: boolean) {
  const now = Date.now();
  const windowHours = Math.min(Math.max(hours, 1), 24 * 30);
  const sinceWindow = new Date(now - windowHours * 60 * 60 * 1000);
  const since5m = new Date(now - 5 * 60 * 1000);
  const since1h = new Date(now - 60 * 60 * 1000);
  const since24h = new Date(now - 24 * 60 * 60 * 1000);

  const botFilter = includeBots ? {} : { isBot: false };

  const visits = await prisma.siteVisit.findMany({
    where: {
      createdAt: { gte: sinceWindow },
      ...botFilter,
    },
    orderBy: { createdAt: 'asc' },
    take: 25000,
  });

  const active5mIps = new Set<string>();
  const unique1hIps = new Set<string>();
  const unique24hIps = new Set<string>();

  // Per-IP aggregation (calculating exact visit sessions & avg interval between visits!)
  const ipMap = new Map<
    string,
    {
      ip: string;
      hits: number;
      sessions: number;
      firstSeen: Date;
      lastSeen: Date;
      lastSessionStart: number;
      totalGapMs: number;
      gapCount: number;
      device: string;
      isMobile: boolean;
      isBot: boolean;
      lastAction: string;
      referer: string;
    }
  >();

  // Hourly traffic buckets in Tbilisi time (UTC+4) for last 24h
  const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    hits: 0,
    ips: new Set<string>(),
  }));

  const refererCounts = new Map<string, number>();
  const actionCounts = new Map<string, number>();
  let mobileHits = 0;
  let totalSessions = 0;

  for (const v of visits) {
    const ts = v.createdAt.getTime();
    if (ts >= since5m.getTime()) active5mIps.add(v.ip);
    if (ts >= since1h.getTime()) unique1hIps.add(v.ip);
    if (ts >= since24h.getTime()) {
      unique24hIps.add(v.ip);
      const tbilisiHour = (v.createdAt.getUTCHours() + 4) % 24;
      hourlyBuckets[tbilisiHour].hits += 1;
      hourlyBuckets[tbilisiHour].ips.add(v.ip);
    }

    if (v.isMobile) mobileHits += 1;
    actionCounts.set(v.action, (actionCounts.get(v.action) || 0) + 1);
    if (v.referer && v.referer !== 'internal') {
      refererCounts.set(v.referer, (refererCounts.get(v.referer) || 0) + 1);
    }

    const existing = ipMap.get(v.ip);
    if (!existing) {
      totalSessions += 1;
      ipMap.set(v.ip, {
        ip: v.ip,
        hits: 1,
        sessions: 1,
        firstSeen: v.createdAt,
        lastSeen: v.createdAt,
        lastSessionStart: ts,
        totalGapMs: 0,
        gapCount: 0,
        device: v.device,
        isMobile: v.isMobile,
        isBot: v.isBot,
        lastAction: v.action,
        referer: v.referer || 'direct',
      });
    } else {
      existing.hits += 1;
      const gap = ts - existing.lastSeen.getTime();
      if (gap >= SESSION_GAP_MS) {
        existing.sessions += 1;
        totalSessions += 1;
        existing.totalGapMs += ts - existing.lastSessionStart;
        existing.gapCount += 1;
        existing.lastSessionStart = ts;
      }
      existing.lastSeen = v.createdAt;
      existing.device = v.device;
      existing.isMobile = v.isMobile;
      existing.lastAction = v.action;
      if (v.referer && v.referer !== 'direct' && v.referer !== 'internal') {
        existing.referer = v.referer;
      }
    }
  }

  const allIps = Array.from(ipMap.values());
  const returningIps = allIps.filter((x) => x.sessions >= 2);
  const returningRatePercent =
    allIps.length > 0 ? Math.round((returningIps.length / allIps.length) * 100) : 0;

  // Global average interval between visits across returning visitors
  let globalGapTotalMs = 0;
  let globalGapCount = 0;
  for (const x of returningIps) {
    globalGapTotalMs += x.totalGapMs;
    globalGapCount += x.gapCount;
  }
  const avgReturnIntervalSec =
    globalGapCount > 0 ? Math.round(globalGapTotalMs / globalGapCount / 1000) : null;

  const topVisitors = allIps
    .sort((a, b) => {
      if (b.sessions !== a.sessions) return b.sessions - a.sessions;
      if (b.hits !== a.hits) return b.hits - a.hits;
      return b.lastSeen.getTime() - a.lastSeen.getTime();
    })
    .slice(0, 30)
    .map((x) => ({
      ip: x.ip,
      sessions: x.sessions,
      hits: x.hits,
      device: x.device,
      isMobile: x.isMobile,
      isBot: x.isBot,
      referer: x.referer,
      lastAction: x.lastAction,
      firstSeen: x.firstSeen.toISOString(),
      lastSeen: x.lastSeen.toISOString(),
      avgIntervalSec: x.gapCount > 0 ? Math.round(x.totalGapMs / x.gapCount / 1000) : null,
    }));

  const topActions = Array.from(actionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));

  const topReferers = Array.from(refererCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }));

  const recent = visits
    .slice(-25)
    .reverse()
    .map((v) => ({
      id: v.id,
      ip: v.ip,
      method: v.method,
      path: v.path,
      action: v.action,
      device: v.device,
      isMobile: v.isMobile,
      isBot: v.isBot,
      referer: v.referer || 'direct',
      statusCode: v.statusCode,
      durationMs: v.durationMs,
      createdAt: v.createdAt.toISOString(),
      ipVisitCount: ipMap.get(v.ip)?.sessions || 1,
      avgGapSeconds: (() => {
        const info = ipMap.get(v.ip);
        return info && info.gapCount > 0 ? Math.round(info.totalGapMs / info.gapCount / 1000) : null;
      })(),
    }));

  return {
    windowHours,
    generatedAt: new Date(now).toISOString(),
    overview: {
      activeNow5m: active5mIps.size,
      uniqueLast1h: unique1hIps.size,
      uniqueLast24h: unique24hIps.size,
      uniqueInWindow: allIps.length,
      totalSessions,
      totalHits: visits.length,
      avgSessionsPerHour: Number((totalSessions / windowHours).toFixed(1)),
      returningVisitors: returningIps.length,
      returningRatePercent,
      avgReturnIntervalSec,
      mobilePercent: visits.length > 0 ? Math.round((mobileHits / visits.length) * 100) : 0,
    },
    hourly24h: hourlyBuckets.map((b) => ({
      hour: b.hour,
      hits: b.hits,
      uniqueIps: b.ips.size,
    })),
    topVisitors,
    topActions,
    topReferers,
    recent,
  };
}

// GET /api/analytics/summary (Admin PIN protected)
router.get(
  '/summary',
  requireAdminPin,
  asyncHandler(async (req: Request, res: Response) => {
    const hours = Number(req.query.hours || 24);
    const includeBots = req.query.bots === '1' || req.query.bots === 'true';
    const summary = await computeAnalyticsSummary(Number.isFinite(hours) ? hours : 24, includeBots);
    res.json(summary);
  })
);

// GET /api/analytics/stream (Admin PIN protected Live SSE Stream!)
router.get('/stream', requireAdminPin, async (req: Request, res: Response) => {
  const includeBots = req.query.bots === '1' || req.query.bots === 'true';

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const client = { res, includeBots };
  sseClients.add(client);

  // Send immediate live snapshot on connect
  try {
    const summary = await computeAnalyticsSummary(24, includeBots);
    const initialRecent =
      summary.recent.length > 0
        ? summary.recent.slice(0, 15).reverse()
        : recentEvents
            .filter((e) => includeBots || !e.isBot)
            .slice(0, 15)
            .reverse();
    res.write(
      `event: init\ndata: ${JSON.stringify({
        overview: summary.overview,
        recent: initialRecent,
      })}\n\n`
    );
  } catch {
    res.write(`event: init\ndata: ${JSON.stringify({ overview: null, recent: [] })}\n\n`);
  }

  // Heartbeat every 20s so Railway proxy never closes the idle SSE socket
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(client);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
});

export default router;

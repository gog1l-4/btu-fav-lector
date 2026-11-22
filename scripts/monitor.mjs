#!/usr/bin/env node
/**
 * spaceuni.online — Live Terminal Traffic & IP Frequency Monitor
 *
 * Usage:
 *   npm run monitor                       # Live real-time visitor stream (spaceuni.online)
 *   npm run monitor:stats                 # Full 24h IP frequency & hourly chart report
 *   node scripts/monitor.mjs --stats --hours=168   # Last 7 days report
 *   node scripts/monitor.mjs --url=http://localhost:4000 --pin=btu2026
 *   node scripts/monitor.mjs --bots       # Include preview bots / crawlers
 */

const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const hasFlag = (name) => args.includes(`--${name}`);

if (hasFlag('help') || hasFlag('h')) {
  console.log(`
spaceuni Live Terminal Monitor
------------------------------
Commands:
  npm run monitor                               Live real-time IP & action stream
  npm run monitor:stats                         Full IP frequency & 24h chart report

Options:
  --url=https://spaceuni.online                 Target server URL (default: https://spaceuni.online)
  --pin=btu2026                                 Admin PIN (or set ADMIN_PIN env var)
  --stats                                       Print full analytics & frequency report and exit
  --hours=24                                    Time window in hours for --stats (default: 24, max: 720)
  --bots                                        Include crawlers/bots (hidden by default)

Hotkeys in Live Mode:
  [s] Print full IP frequency & hourly stats report
  [c] Clear terminal screen
  [q] Quit
`);
  process.exit(0);
}

const BASE_URL = (getArg('url', process.env.MONITOR_URL || 'https://spaceuni.online')).replace(/\/+$/, '');
const ADMIN_PIN = getArg('pin', process.env.ADMIN_PIN || 'btu2026');
const STATS_ONLY = hasFlag('stats');
const INCLUDE_BOTS = hasFlag('bots');
const HOURS = Number(getArg('hours', '24')) || 24;

// ANSI Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  gold: '\x1b[38;5;180m',
  brightGold: '\x1b[38;5;222m',
  green: '\x1b[38;5;84m',
  cyan: '\x1b[38;5;81m',
  yellow: '\x1b[38;5;221m',
  red: '\x1b[38;5;203m',
  magenta: '\x1b[38;5;177m',
  gray: '\x1b[38;5;244m',
  white: '\x1b[97m',
};

function formatTbilisiTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ka-GE', {
    timeZone: 'Asia/Tbilisi',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTbilisiShort(iso) {
  const d = new Date(iso);
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}წმ წინ`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}წთ წინ`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}სთ წინ`;
  return `${Math.floor(diffSec / 86400)}დღ წინ`;
}

function formatInterval(sec) {
  if (sec === null || sec === undefined) return '1-ლი ვიზიტი';
  if (sec < 60) return `ყოველ ${sec}წმ`;
  if (sec < 3600) return `ყოველ ${Math.round(sec / 60)}წთ`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h < 24) return m > 0 ? `ყოველ ${h}სთ ${m}წთ` : `ყოველ ${h}სთ`;
  const days = (h / 24).toFixed(1);
  return `ყოველ ${days} დღე`;
}

function pad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function formatEventLine(ev) {
  const time = `${C.gray}${formatTbilisiTime(ev.createdAt)}${C.reset}`;
  const ip = `${C.cyan}${pad(ev.ip, 16)}${C.reset}`;

  const sessionTag = ev.isBot
    ? `${C.gray}[BOT]${C.reset}`
    : ev.ipVisitCount > 1
    ? `${C.brightGold}[#${ev.ipVisitCount}${ev.avgGapSeconds ? ` • ${formatInterval(ev.avgGapSeconds)}` : ''}]${C.reset}`
    : `${C.green}[ახალი #1]${C.reset}`;

  let actionColor = C.white;
  if (ev.action.includes('ხმა')) actionColor = C.green;
  else if (ev.action.includes('ატვირთა')) actionColor = C.brightGold;
  else if (ev.action.includes('BTU')) actionColor = C.magenta;
  else if (ev.action.includes('რეპორტ')) actionColor = C.red;
  else if (ev.action.includes('ადმინ')) actionColor = C.yellow;

  const devIcon = ev.isBot ? '🤖' : ev.isMobile ? '📱' : '💻';
  const refPart =
    ev.referer && ev.referer !== 'direct' && ev.referer !== 'internal'
      ? ` ${C.dim}← ${ev.referer}${C.reset}`
      : '';
  const msColor = ev.durationMs > 800 ? C.red : ev.durationMs > 250 ? C.yellow : C.gray;

  return `${time} │ ${ip} │ ${sessionTag} ${actionColor}${ev.action}${C.reset} │ ${devIcon} ${C.dim}${ev.device}${C.reset}${refPart} ${msColor}(${ev.durationMs}ms)${C.reset}`;
}

async function fetchSummary(hours = HOURS) {
  const url = `${BASE_URL}/api/analytics/summary?hours=${hours}&bots=${INCLUDE_BOTS ? '1' : '0'}`;
  const res = await fetch(url, {
    headers: { 'x-admin-pin': ADMIN_PIN },
  });
  if (res.status === 401) {
    throw new Error('არასწორი ADMIN_PIN! გაუშვი --pin=შენი_პინი ან დააყენე ADMIN_PIN ცვლადი.');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 150)}`);
  }
  return await res.json();
}

function printBanner(overview) {
  const line = `${C.gold}${'═'.repeat(86)}${C.reset}`;
  console.log('');
  console.log(line);
  console.log(
    `${C.bold}${C.brightGold}  SPACEUNI LIVE TRAFFIC MONITOR${C.reset}  ${C.dim}│  ${BASE_URL}  │  ${
      INCLUDE_BOTS ? 'Bots: ON' : 'Humans Only'
    }${C.reset}`
  );
  if (overview) {
    console.log(
      `  ${C.green}● ონლაინ (5წთ): ${C.bold}${overview.activeNow5m}${C.reset}   ` +
        `${C.cyan}👥 1სთ: ${C.bold}${overview.uniqueLast1h}${C.reset}   ` +
        `${C.white}👥 24სთ: ${C.bold}${overview.uniqueLast24h}${C.reset}   ` +
        `${C.brightGold}⚡ სესია/სთ: ${C.bold}${overview.avgSessionsPerHour}${C.reset}   ` +
        `${C.magenta}🔁 დაბრუნება: ${C.bold}${overview.returningRatePercent}%${C.reset}   ` +
        `${C.dim}📱 ${overview.mobilePercent}%${C.reset}`
    );
  }
  console.log(line);
}

function printFullReport(data) {
  const ov = data.overview;
  printBanner(ov);

  console.log(
    `\n${C.bold}${C.gold}📊 შეჯამება (ბოლო ${data.windowHours} საათი):${C.reset}`
  );
  console.log(
    `   • უნიკალური IP-ები: ${C.bold}${C.white}${ov.uniqueInWindow}${C.reset}   ` +
      `• სულ სესიები (ვიზიტები): ${C.bold}${C.white}${ov.totalSessions}${C.reset}   ` +
      `• სულ ქმედებები: ${C.bold}${C.white}${ov.totalHits}${C.reset}`
  );
  console.log(
    `   • დაბრუნებული ვიზიტორები (2+ სესია): ${C.bold}${C.green}${ov.returningVisitors} (${ov.returningRatePercent}%)${C.reset}   ` +
      `• დაბრუნების საშ. სიხშირე: ${C.bold}${C.brightGold}${formatInterval(ov.avgReturnIntervalSec)}${C.reset}`
  );

  // 24h Hourly Bar Chart (Tbilisi time)
  const maxHourly = Math.max(1, ...data.hourly24h.map((h) => h.hits));
  console.log(`\n${C.bold}${C.gold}📈 24-საათიანი აქტივობა (თბილისის დროით):${C.reset}`);
  const activeHours = data.hourly24h.filter((h) => h.hits > 0);
  if (activeHours.length === 0) {
    console.log(`   ${C.dim}ჯერ მონაცემები გროვდება...${C.reset}`);
  } else {
    for (const h of data.hourly24h) {
      if (h.hits === 0) continue;
      const barLen = Math.max(1, Math.round((h.hits / maxHourly) * 32));
      const bar = '█'.repeat(barLen);
      const hh = String(h.hour).padStart(2, '0');
      console.log(
        `   ${C.gray}${hh}:00${C.reset} │ ${C.gold}${bar}${C.reset} ${C.white}${h.hits}${C.reset} ${C.dim}(${h.uniqueIps} IP)${C.reset}`
      );
    }
  }

  // Top Visitors by IP + Frequency
  console.log(`\n${C.bold}${C.gold}🌍 IP ვიზიტორები და შემოსვლის სიხშირე:${C.reset}`);
  if (!data.topVisitors || data.topVisitors.length === 0) {
    console.log(`   ${C.dim}ვიზიტორები ჯერ არ დაფიქსირებულა.${C.reset}`);
  } else {
    console.log(
      `   ${C.dim}${pad('IP მისამართი', 17)} ${pad('სესია', 6)} ${pad('ჰიტი', 6)} ${pad(
        'სიხშირე',
        16
      )} ${pad('მოწყობილობა', 21)} ${pad('ბოლო ვიზიტი', 11)} ბოლო ქმედება${C.reset}`
    );
    console.log(`   ${C.dim}${'─'.repeat(98)}${C.reset}`);
    for (const v of data.topVisitors.slice(0, 20)) {
      const freq = formatInterval(v.avgIntervalSec);
      const icon = v.isBot ? '🤖' : v.isMobile ? '📱' : '💻';
      console.log(
        `   ${C.cyan}${pad(v.ip, 17)}${C.reset} ` +
          `${C.brightGold}${pad(v.sessions, 6)}${C.reset} ` +
          `${C.white}${pad(v.hits, 6)}${C.reset} ` +
          `${v.sessions > 1 ? C.green : C.gray}${pad(freq, 16)}${C.reset} ` +
          `${icon} ${C.dim}${pad(v.device, 19)}${C.reset} ` +
          `${C.gray}${pad(formatTbilisiShort(v.lastSeen), 11)}${C.reset} ` +
          `${C.white}${v.lastAction}${C.reset}`
      );
    }
  }

  // Top Actions & Referers
  if (data.topActions?.length > 0) {
    const actionsStr = data.topActions
      .slice(0, 6)
      .map((a) => `${C.white}${a.action}${C.reset} (${C.gold}${a.count}${C.reset})`)
      .join('  •  ');
    console.log(`\n${C.bold}${C.gold}⚡ ქმედებები:${C.reset}  ${actionsStr}`);
  }

  if (data.topReferers?.length > 0) {
    const refStr = data.topReferers
      .map((r) => `${C.cyan}${r.source}${C.reset} (${C.white}${r.count}${C.reset})`)
      .join('  •  ');
    console.log(`${C.bold}${C.gold}🔗 წყაროები:${C.reset}  ${refStr}`);
  }
  console.log('');
}

async function startLiveStream() {
  // Enable single-key hotkeys when running in interactive terminal
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (key) => {
      if (key === '\u0003' || key === 'q' || key === 'Q') {
        console.log(`\n${C.dim}მონიტორი გაითიშა.${C.reset}`);
        process.exit(0);
      } else if (key === 'c' || key === 'C') {
        console.clear();
        try {
          const data = await fetchSummary(24);
          printBanner(data.overview);
        } catch {
          printBanner(null);
        }
      } else if (key === 's' || key === 'S') {
        try {
          const data = await fetchSummary(HOURS);
          printFullReport(data);
          console.log(`${C.dim}  [Live ნაკადი გრძელდება — დააჭირე s=სტატისტიკა | c=გასუფთავება | q=გასვლა]${C.reset}\n`);
        } catch (err) {
          console.log(`${C.red}შეცდომა: ${err.message}${C.reset}`);
        }
      }
    });
  }

  let reconnectDelay = 2000;

  while (true) {
    try {
      const streamUrl = `${BASE_URL}/api/analytics/stream?bots=${INCLUDE_BOTS ? '1' : '0'}`;
      const res = await fetch(streamUrl, {
        headers: {
          'x-admin-pin': ADMIN_PIN,
          Accept: 'text/event-stream',
        },
      });

      if (res.status === 401) {
        console.error(`${C.red}❌ არასწორი ADMIN_PIN! გაუშვი: node scripts/monitor.mjs --pin=შენი_პინი${C.reset}`);
        process.exit(1);
      }
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      reconnectDelay = 2000;
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentEvent = 'message';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (!line) {
            currentEvent = 'message';
            continue;
          }
          if (line.startsWith(':')) continue; // heartbeat
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            const jsonText = line.slice(5).trim();
            try {
              const payload = JSON.parse(jsonText);
              if (currentEvent === 'init') {
                printBanner(payload.overview);
                console.log(
                  `${C.dim}  ცხელი ღილაკები: [s] სრული IP სტატისტიკა და გრაფიკი   [c] გასუფთავება   [q] გასვლა${C.reset}\n`
                );
                if (Array.isArray(payload.recent) && payload.recent.length > 0) {
                  console.log(`${C.dim}  ── ბოლო ვიზიტები ──${C.reset}`);
                  for (const ev of payload.recent) {
                    console.log('  ' + formatEventLine(ev));
                  }
                  console.log(`${C.green}  ── 🟢 LIVE ნაკადი ჩართულია (ელოდება ახალ ვიზიტორებს...) ──${C.reset}`);
                } else {
                  console.log(`${C.green}  🟢 LIVE ნაკადი ჩართულია — გახსენი ${BASE_URL} და აქ წამში გამოჩნდება!${C.reset}`);
                }
              } else if (currentEvent === 'visit') {
                console.log('  ' + formatEventLine(payload));
              }
            } catch {
              // Ignore malformed chunk
            }
          }
        }
      }

      throw new Error('კავშირი დაიხურა');
    } catch (err) {
      console.log(
        `${C.yellow}⚠️ კავშირი გაწყდა (${err.message}). თავიდან დაკავშირება ${Math.round(
          reconnectDelay / 1000
        )} წამში...${C.reset}`
      );
      await new Promise((r) => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
    }
  }
}

async function main() {
  if (STATS_ONLY) {
    try {
      const data = await fetchSummary(HOURS);
      printFullReport(data);
    } catch (err) {
      console.error(`${C.red}❌ შეცდომა: ${err.message}${C.reset}`);
      process.exit(1);
    }
    return;
  }

  await startLiveStream();
}

main();

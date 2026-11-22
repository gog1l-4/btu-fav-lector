import type { LectorBattle } from '../types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If cross-origin fails, try without crossOrigin or reject
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => reject(new Error('Failed to load image: ' + src));
      fallbackImg.src = src;
    };
    img.src = src;
  });
}

function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.clip();

  // Cover aspect ratio
  const imgRatio = img.width / img.height;
  const targetRatio = width / height;
  let sWidth = img.width;
  let sHeight = img.height;
  let sx = 0;
  let sy = 0;

  if (imgRatio > targetRatio) {
    sWidth = img.height * targetRatio;
    sx = (img.width - sWidth) / 2;
  } else {
    sHeight = img.width / targetRatio;
    sy = (img.height - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill = true,
  stroke = false
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

export async function generateInstagramStory(battle: LectorBattle): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 1. Dark Futuristic Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
  bgGrad.addColorStop(0, '#090D16');
  bgGrad.addColorStop(0.5, '#0B0F19');
  bgGrad.addColorStop(1, '#05070B');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Neon Ambient Glows
  // Indigo glow top-left
  const glow1 = ctx.createRadialGradient(250, 450, 50, 250, 450, 450);
  glow1.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
  glow1.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glow1;
  ctx.beginPath();
  ctx.arc(250, 450, 450, 0, Math.PI * 2);
  ctx.fill();

  // Pink glow bottom-right
  const glow2 = ctx.createRadialGradient(830, 1350, 50, 830, 1350, 450);
  glow2.addColorStop(0, 'rgba(236, 72, 153, 0.25)');
  glow2.addColorStop(1, 'rgba(236, 72, 153, 0)');
  ctx.fillStyle = glow2;
  ctx.beginPath();
  ctx.arc(830, 1350, 450, 0, Math.PI * 2);
  ctx.fill();

  // 2. Top Header Badge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  roundRect(ctx, 240, 100, 600, 72, 36, true, false);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 240, 100, 600, 72, 36, false, true);

  ctx.fillStyle = '#F43F5E';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔥 SPACEUNI • BTU ARENA', 540, 136);

  // Main Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 64px system-ui, -apple-system, sans-serif';
  ctx.fillText('კვირის ბრძოლა', 540, 230);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 32px system-ui, -apple-system, sans-serif';
  ctx.fillText('რომელ ლექტორს ანიჭებ უპირატესობას?', 540, 290);

  // 3. Lecturer 1 Card (Top)
  // Card Container Box
  ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
  roundRect(ctx, 100, 360, 880, 480, 36, true, false);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.lineWidth = 3;
  roundRect(ctx, 100, 360, 880, 480, 36, false, true);

  // Load and Draw Lecturer 1 Photo
  try {
    const photo1 = await loadImage(battle.lector1Photo);
    drawRoundedImage(ctx, photo1, 140, 400, 400, 400, 28);
  } catch (err) {
    // Fallback placeholder box
    ctx.fillStyle = '#312E81';
    roundRect(ctx, 140, 400, 400, 400, 28, true, false);
  }

  // Lecturer 1 Info (Right side of card)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  ctx.fillText(battle.lector1Name, 570, 460);

  ctx.fillStyle = '#818CF8';
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(battle.lector1Subject || 'BTU ლექტორი', 570, 520);

  // Percentage & Votes Pill
  ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
  roundRect(ctx, 570, 580, 370, 110, 24, true, false);
  ctx.strokeStyle = '#6366F1';
  ctx.lineWidth = 2;
  roundRect(ctx, 570, 580, 370, 110, 24, false, true);

  ctx.fillStyle = '#A5B4FC';
  ctx.font = '900 64px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${battle.lector1Percent}%`, 600, 642);

  ctx.fillStyle = '#E0E7FF';
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${battle.lector1Votes} ხმა`, 760, 642);

  // 4. Center "VS" Badge
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Outer glowing circle
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(540, 890, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#F43F5E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(540, 890, 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 38px system-ui, -apple-system, sans-serif';
  ctx.fillText('VS', 540, 890);

  // 5. Lecturer 2 Card (Bottom)
  ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
  roundRect(ctx, 100, 940, 880, 480, 36, true, false);
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
  ctx.lineWidth = 3;
  roundRect(ctx, 100, 940, 880, 480, 36, false, true);

  // Load and Draw Lecturer 2 Photo
  try {
    const photo2 = await loadImage(battle.lector2Photo);
    drawRoundedImage(ctx, photo2, 140, 980, 400, 400, 28);
  } catch (err) {
    ctx.fillStyle = '#831843';
    roundRect(ctx, 140, 980, 400, 400, 28, true, false);
  }

  // Lecturer 2 Info (Right side of card)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  ctx.fillText(battle.lector2Name, 570, 1040);

  ctx.fillStyle = '#F472B6';
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(battle.lector2Subject || 'BTU ლექტორი', 570, 1100);

  // Percentage & Votes Pill
  ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
  roundRect(ctx, 570, 1160, 370, 110, 24, true, false);
  ctx.strokeStyle = '#EC4899';
  ctx.lineWidth = 2;
  roundRect(ctx, 570, 1160, 370, 110, 24, false, true);

  ctx.fillStyle = '#F472B6';
  ctx.font = '900 64px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${battle.lector2Percent}%`, 600, 1222);

  ctx.fillStyle = '#FCE7F3';
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${battle.lector2Votes} ხმა`, 760, 1222);

  // 6. Dual-Color Battle Progress Bar
  const barY = 1480;
  const barWidth = 880;
  const barHeight = 28;
  const l1Width = Math.max(16, (battle.lector1Percent / 100) * barWidth);
  const l2Width = barWidth - l1Width;

  // Background track
  ctx.fillStyle = '#1E293B';
  roundRect(ctx, 100, barY, barWidth, barHeight, 14, true, false);

  // Left progress (Indigo)
  ctx.fillStyle = '#6366F1';
  roundRect(ctx, 100, barY, l1Width, barHeight, 14, true, false);

  // Right progress (Pink)
  ctx.fillStyle = '#EC4899';
  roundRect(ctx, 100 + l1Width, barY, l2Width, barHeight, 14, true, false);

  // Total votes counter
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`სულ დაფიქსირდა: ${battle.totalVotes} ხმა`, 540, 1560);

  // 7. Footer Call to Action & Instagram Tag
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  roundRect(ctx, 100, 1620, 880, 180, 32, true, false);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 100, 1620, 880, 180, 32, false, true);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillText('📲 ხმა მიეცი შენც ბიოში არსებულ ლინკზე!', 540, 1680);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 32px system-ui, -apple-system, sans-serif';
  ctx.fillText('SPACEUNI • სტუდენტური არჩევანი', 540, 1740);

  return canvas.toDataURL('image/png');
}

export async function generateStudentStoryImage(profile: {
  name: string;
  photo: string;
  instagram?: string | null;
  rank?: number | null;
  winPercent: number;
}): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not supported');

  // Obsidian luxury background
  const bg = ctx.createLinearGradient(0, 0, 1080, 1920);
  bg.addColorStop(0, '#0E1118');
  bg.addColorStop(0.5, '#0B0D12');
  bg.addColorStop(1, '#12151E');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle gold radial glow
  const glow = ctx.createRadialGradient(540, 260, 40, 540, 260, 620);
  glow.addColorStop(0, 'rgba(216, 190, 147, 0.22)');
  glow.addColorStop(1, 'rgba(216, 190, 147, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1000);

  // Top badge
  ctx.fillStyle = 'rgba(216, 190, 147, 0.12)';
  roundRect(ctx, 290, 110, 500, 74, 37, true, false);
  ctx.strokeStyle = 'rgba(216, 190, 147, 0.45)';
  ctx.lineWidth = 2;
  roundRect(ctx, 290, 110, 500, 74, 37, false, true);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#E8D3AD';
  ctx.font = '800 30px DachiTheLynx, system-ui, sans-serif';
  ctx.fillText('SPACEUNI • BTU STUDENTS', 540, 148);

  // Headline
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 58px DachiTheLynx, system-ui, sans-serif';
  ctx.fillText('მომეცი ხმა spaceuni-ზე!', 540, 268);

  // Portrait card frame
  const cardX = 140;
  const cardY = 360;
  const cardW = 800;
  const cardH = 1040;

  ctx.fillStyle = '#141720';
  roundRect(ctx, cardX, cardY, cardW, cardH, 46, true, false);

  try {
    const img = await loadImage(profile.photo);
    drawRoundedImage(ctx, img, cardX, cardY, cardW, cardH, 46);
  } catch {
    // fallback card background already painted
  }

  // Bottom gradient overlay on portrait
  const overlay = ctx.createLinearGradient(0, cardY + 520, 0, cardY + cardH);
  overlay.addColorStop(0, 'rgba(0,0,0,0)');
  overlay.addColorStop(1, 'rgba(9,11,16,0.95)');
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 46, false, false);
  ctx.clip();
  ctx.fillStyle = overlay;
  ctx.fillRect(cardX, cardY + 520, cardW, 520);
  ctx.restore();

  // Gold card border
  ctx.strokeStyle = 'rgba(216, 190, 147, 0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, cardX, cardY, cardW, cardH, 46, false, true);

  // Rank pill if ranked
  if (profile.rank) {
    ctx.fillStyle = '#D8BE93';
    roundRect(ctx, cardX + 38, cardY + 38, 220, 68, 34, true, false);
    ctx.fillStyle = '#0B0D12';
    ctx.font = '900 32px DachiTheLynx, system-ui, sans-serif';
    ctx.fillText(`👑 #${profile.rank} ტოპში`, cardX + 148, cardY + 73);
  }

  // Name & Instagram on card
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 58px DachiTheLynx, system-ui, sans-serif';
  ctx.fillText(profile.name, 540, cardY + cardH - 135);

  if (profile.instagram) {
    ctx.fillStyle = '#E8D3AD';
    ctx.font = '600 34px BPGNinoMedium, system-ui, sans-serif';
    ctx.fillText(`@${profile.instagram}`, 540, cardY + cardH - 68);
  }

  // CTA box
  ctx.fillStyle = 'rgba(216, 190, 147, 0.14)';
  roundRect(ctx, 140, 1490, 800, 190, 36, true, false);
  ctx.strokeStyle = 'rgba(216, 190, 147, 0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, 140, 1490, 800, 190, 36, false, true);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 40px DachiTheLynx, system-ui, sans-serif';
  ctx.fillText('spaceuni.online', 540, 1558);

  ctx.fillStyle = '#D8BE93';
  ctx.font = '500 30px BPGNinoMedium, system-ui, sans-serif';
  ctx.fillText('შემოდი სტუდენტების ბრძოლაში და აირჩიე ფავორიტი ✨', 540, 1624);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename = 'spaceuni-battle.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

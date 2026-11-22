import type { StudentFilter } from '../types';

const STUDENT_TOKEN_KEY = 'spaceuni_btu_token';
const STUDENT_EMAIL_KEY = 'spaceuni_btu_email';
const STUDENT_FILTER_KEY = 'spaceuni_student_filter';

export function getStudentToken(): string | null {
  try {
    return localStorage.getItem(STUDENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStudentEmail(): string | null {
  try {
    return localStorage.getItem(STUDENT_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setStudentAuth(token: string, email: string): void {
  try {
    localStorage.setItem(STUDENT_TOKEN_KEY, token);
    localStorage.setItem(STUDENT_EMAIL_KEY, email.toLowerCase().trim());
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStudentAuth(): void {
  try {
    localStorage.removeItem(STUDENT_TOKEN_KEY);
    localStorage.removeItem(STUDENT_EMAIL_KEY);
  } catch {
    // Ignore
  }
}

export function getStoredStudentFilter(): StudentFilter | null {
  try {
    const val = localStorage.getItem(STUDENT_FILTER_KEY);
    if (val === 'ALL' || val === 'MALE' || val === 'FEMALE') {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredStudentFilter(filter: StudentFilter): void {
  try {
    localStorage.setItem(STUDENT_FILTER_KEY, filter);
  } catch {
    // Ignore
  }
}

export class StudentApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function studentApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStudentToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('x-student-token', token);
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api/students${path}`, {
    ...options,
    headers,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.message || payload?.error || `მოთხოვნის შეცდომა (${response.status})`;
    if (response.status === 401 && payload?.code === 'BTU_AUTH_REQUIRED' && token) {
      // Token expired or invalid
      clearStudentAuth();
    }
    throw new StudentApiError(message, response.status, payload?.code);
  }

  return payload as T;
}

/**
 * Compresses and center-crops an uploaded image file (up to 10MB) into a crisp
 * 3:4 portrait JPEG Data URL (~150-240 KB) so uploads stay fast and database-friendly.
 */
export async function compressPortraitPhoto(file: File): Promise<string> {
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (!file.type.startsWith('image/')) {
    throw new Error('გთხოვთ აირჩიოთ მხოლოდ სურათის ფაილი (JPG, PNG, WebP)');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('ფოტოს ზომა არ უნდა აღემატებოდეს 10 MB-ს');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ფოტოს წაკითხვა ვერ მოხერხდა'));
    reader.readAsDataURL(file);
  });

  return await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const targetW = 780;
        const targetH = 1040; // Exact 3:4 portrait matching our VS cards
        const targetRatio = targetW / targetH;
        const srcRatio = img.width / img.height;

        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (srcRatio > targetRatio) {
          // Landscape / wider image: crop horizontally centered
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          // Taller image: bias crop slightly toward the top (faces!)
          sh = img.width / targetRatio;
          sy = Math.max(0, (img.height - sh) * 0.2);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        ctx.fillStyle = '#0B0D12';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

        const compressed = canvas.toDataURL('image/jpeg', 0.86);
        resolve(compressed);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => reject(new Error('სურათის ფორმატი ვერ დამუშავდა — სცადეთ JPG ან PNG'));
    img.src = rawDataUrl;
  });
}

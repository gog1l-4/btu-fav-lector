import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    return res.status(400).json({
      error: firstIssue?.message || 'მონაცემების ვალიდაციის შეცდომა',
      details: err.issues,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034') {
      return res.status(409).json({
        error: 'პარალელური მოთხოვნის კონფლიქტი — განცხადებაზე სხვა გაცვლა უკვე მუშავდება',
      });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'ასეთი ჩანაწერი უკვე არსებობს' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'მოთხოვნილი ჩანაწერი ვერ მოიძებნა' });
    }
  }

  console.error('[Unhandled Server Error]', err);
  return res.status(500).json({ error: 'სერვერზე მოხდა შეცდომა, სცადეთ მოგვიანებით' });
}

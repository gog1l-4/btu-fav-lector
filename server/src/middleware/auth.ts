import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from './errorHandler.js';

export interface AuthJwtPayload {
  userId: string;
  role: 'STUDENT' | 'ADMIN';
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'STUDENT' | 'ADMIN';
    universityId: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function signAuthToken(payload: AuthJwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '180d' });
}

export function verifyAuthToken(token: string): AuthJwtPayload {
  return jwt.verify(token, env.jwtSecret) as AuthJwtPayload;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('ავტორიზაცია აუცილებელია', 401);
    }

    const decoded = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        universityId: true,
        firstName: true,
        lastName: true,
        email: true,
        isSuspended: true,
      },
    });

    if (!user) {
      throw new AppError('მომხმარებელი ვერ მოიძებნა', 401);
    }
    if (user.isSuspended) {
      throw new AppError('თქვენი ანგარიში დროებით შეზღუდულია', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('არავალიდური ან ვადაგასული სესია', 401));
  }
}

export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        universityId: true,
        firstName: true,
        lastName: true,
        email: true,
        isSuspended: true,
      },
    });

    if (user && !user.isSuspended) {
      req.user = user;
    }
    next();
  } catch {
    next();
  }
}

export function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('ადმინისტრატორის უფლებები აუცილებელია', 403));
  }
  next();
}

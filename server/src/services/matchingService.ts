import { prisma } from '../config/prisma.js';

function normalizeTime(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

export interface SmartMatchResult {
  myListing: {
    id: string;
    courseName: string;
    courseCode: string;
    currentGroupCode: string;
    currentDay: string;
    currentTime: string;
    currentLecturerName: string;
    desiredTime: string;
    desiredDay: string | null;
    desiredLecturerName: string | null;
  };
  matchedListing: {
    id: string;
    courseId: string;
    courseName: string;
    courseCode: string;
    currentGroupCode: string;
    currentDay: string;
    currentTime: string;
    currentLecturerName: string;
    desiredGroupCode: string | null;
    desiredDay: string | null;
    desiredTime: string;
    desiredLecturerName: string | null;
    comment: string | null;
    createdAt: Date;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      studentVerificationStatus: string;
      university: { shortName: string; name: string };
      faculty: { name: string } | null;
    };
  };
  matchScore: number;
  matchReasons: string[];
}

export async function findSmartMatchesForUser(userId: string): Promise<SmartMatchResult[]> {
  const myListings = await prisma.swapListing.findMany({
    where: {
      authorId: userId,
      status: 'OPEN',
    },
    include: {
      course: true,
    },
  });

  if (myListings.length === 0) {
    return [];
  }

  const courseIds = [...new Set(myListings.map((l) => l.courseId))];
  const candidates = await prisma.swapListing.findMany({
    where: {
      status: 'OPEN',
      authorId: { not: userId },
      courseId: { in: courseIds },
    },
    include: {
      course: true,
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          studentVerificationStatus: true,
          university: { select: { shortName: true, name: true } },
          faculty: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const results: SmartMatchResult[] = [];

  for (const mine of myListings) {
    for (const candidate of candidates) {
      if (candidate.courseId !== mine.courseId || candidate.universityId !== mine.universityId) {
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      const myDesiredTime = normalizeTime(mine.desiredTime);
      const candCurrentTime = normalizeTime(candidate.currentTime);
      const candDesiredTime = normalizeTime(candidate.desiredTime);
      const myCurrentTime = normalizeTime(mine.currentTime);

      // Reciprocal time check
      const candOffersWhatIWant =
        myDesiredTime.includes('ნებისმიერი') ||
        (candCurrentTime && myDesiredTime && (candCurrentTime.includes(myDesiredTime) || myDesiredTime.includes(candCurrentTime)));

      const iOfferWhatCandWants =
        candDesiredTime.includes('ნებისმიერი') ||
        (myCurrentTime && candDesiredTime && (myCurrentTime.includes(candDesiredTime) || candDesiredTime.includes(myCurrentTime)));

      if (!candOffersWhatIWant || !iOfferWhatCandWants) {
        continue;
      }

      score += 65;
      reasons.push('დროები ორმხრივად ემთხვევა');

      // Day compatibility
      if (!mine.desiredDay || normalizeText(mine.desiredDay) === normalizeText(candidate.currentDay)) {
        score += 15;
        if (mine.desiredDay) reasons.push('სასურველი დღე ემთხვევა');
      }

      // Lecturer compatibility
      if (
        !mine.desiredLecturerName ||
        normalizeText(mine.desiredLecturerName) === normalizeText(candidate.currentLecturerName)
      ) {
        score += 10;
        if (mine.desiredLecturerName) reasons.push('სასურველი ლექტორი ემთხვევა');
      }

      if (
        !candidate.desiredLecturerName ||
        normalizeText(candidate.desiredLecturerName) === normalizeText(mine.currentLecturerName)
      ) {
        score += 10;
      }

      results.push({
        myListing: {
          id: mine.id,
          courseName: mine.course.name,
          courseCode: mine.course.code,
          currentGroupCode: mine.currentGroupCode,
          currentDay: mine.currentDay,
          currentTime: mine.currentTime,
          currentLecturerName: mine.currentLecturerName,
          desiredTime: mine.desiredTime,
          desiredDay: mine.desiredDay,
          desiredLecturerName: mine.desiredLecturerName,
        },
        matchedListing: {
          id: candidate.id,
          courseId: candidate.courseId,
          courseName: candidate.course.name,
          courseCode: candidate.course.code,
          currentGroupCode: candidate.currentGroupCode,
          currentDay: candidate.currentDay,
          currentTime: candidate.currentTime,
          currentLecturerName: candidate.currentLecturerName,
          desiredGroupCode: candidate.desiredGroupCode,
          desiredDay: candidate.desiredDay,
          desiredTime: candidate.desiredTime,
          desiredLecturerName: candidate.desiredLecturerName,
          comment: candidate.comment,
          createdAt: candidate.createdAt,
          author: candidate.author,
        },
        matchScore: Math.min(100, score),
        matchReasons: reasons,
      });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

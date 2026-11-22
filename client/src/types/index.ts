export type UserRole = 'STUDENT' | 'ADMIN';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
export type ListingStatus = 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface Faculty {
  id: string;
  universityId: string;
  name: string;
  degreeLevel: string;
}

export interface University {
  id: string;
  name: string;
  shortName: string;
  emailDomain: string | null;
  city: string;
  faculties?: Faculty[];
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  universityId: string;
  facultyId: string | null;
  studyYear: number;
  avatarUrl: string | null;
  bio: string | null;
  isEmailVerified: boolean;
  studentVerificationStatus: VerificationStatus;
  studentIdNumber: string | null;
  emailNotifyOffers: boolean;
  emailNotifyMessages: boolean;
  pushNotifyEnabled: boolean;
  createdAt: string;
  university: {
    id: string;
    name: string;
    shortName: string;
    emailDomain?: string | null;
  };
  faculty: {
    id: string;
    name: string;
    degreeLevel?: string;
  } | null;
}

export interface UserCounts {
  unreadNotifications: number;
  unreadMessages: number;
  activeOffersCount: number;
  completedSwapsCount: number;
}

export interface Course {
  id: string;
  universityId: string;
  facultyId: string | null;
  code: string;
  name: string;
  credits: number;
}

export interface Lecturer {
  id: string;
  universityId: string;
  fullName: string;
  department: string | null;
}

export interface AcademicGroup {
  id: string;
  universityId: string;
  courseId: string;
  lecturerId: string;
  groupCode: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
  course?: { id: string; name: string; code: string };
  lecturer?: { id: string; fullName: string };
}

export interface SwapListing {
  id: string;
  authorId: string;
  universityId: string;
  courseId: string;
  currentLecturerId: string | null;
  currentLecturerName: string;
  currentGroupId: string | null;
  currentGroupCode: string;
  currentDay: string;
  currentTime: string;
  desiredLecturerId: string | null;
  desiredLecturerName: string | null;
  desiredGroupCode: string | null;
  desiredDay: string | null;
  desiredTime: string;
  comment: string | null;
  status: ListingStatus;
  acceptedOfferId: string | null;
  createdAt: string;
  updatedAt: string;
  isSaved?: boolean;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    studyYear: number;
    studentVerificationStatus: VerificationStatus;
    university: { id: string; name: string; shortName: string };
    faculty: { id: string; name: string } | null;
  };
  university: { id: string; name: string; shortName: string };
  course: { id: string; code: string; name: string };
  _count?: {
    offers: number;
    savedBy: number;
  };
}

export interface SwapOffer {
  id: string;
  listingId: string;
  senderId: string;
  receiverId: string;
  offeredGroupCode: string;
  offeredLecturerName: string;
  offeredDay: string;
  offeredTime: string;
  message: string | null;
  status: OfferStatus;
  respondedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  listing: SwapListing;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    studyYear: number;
    studentVerificationStatus: VerificationStatus;
    university: { shortName: string };
    faculty: { name: string } | null;
  };
  receiver: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    studyYear: number;
    studentVerificationStatus: VerificationStatus;
    university: { shortName: string };
    faculty: { name: string } | null;
  };
  conversation?: { id: string } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  offer: {
    id: string;
    status: OfferStatus;
    listing: {
      id: string;
      course: { name: string; code: string };
    };
  } | null;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    studentVerificationStatus: VerificationStatus;
    university: { shortName: string };
  };
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SmartMatch {
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
    createdAt: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      studentVerificationStatus: VerificationStatus;
      university: { shortName: string; name: string };
      faculty: { name: string } | null;
    };
  };
  matchScore: number;
  matchReasons: string[];
}

export interface LectorBattle {
  id: string;
  title: string;
  description: string | null;
  lector1Name: string;
  lector1Subject: string;
  lector1Photo: string;
  lector1Votes: number;
  lector2Name: string;
  lector2Subject: string;
  lector2Photo: string;
  lector2Votes: number;
  totalVotes: number;
  lector1Percent: number;
  lector2Percent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    votes: number;
  };
}

export interface BattleActiveResponse {
  battle: LectorBattle | null;
  hasVoted: boolean;
  userVote: number | null;
}

export interface LeaderboardItem {
  id: string;
  rank: number;
  name: string;
  subject?: string;
  isCrown: boolean;
  percent: number;
  votes?: number;
  avatar: string;
}

export interface BattleFeedResponse {
  battles: (LectorBattle & { hasVoted?: boolean; userVote?: number | null })[];
  stats: {
    totalVotes: number;
    totalBattles: number;
    totalLectors: number;
    university: string;
  };
  leaderboard: LeaderboardItem[];
}

export type StudentGender = 'MALE' | 'FEMALE';
export type StudentFilter = 'ALL' | 'MALE' | 'FEMALE';
export type StudentRelationType = 'SELF' | 'FRIEND';
export type StudentModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PublicStudentProfile {
  id: string;
  name: string;
  gender: StudentGender;
  photo: string;
  instagram: string | null;
  eloRating: number;
  wins: number;
  winPercent: number;
}

export interface StudentLeaderboardItem extends PublicStudentProfile {
  rank: number;
  isCrown: boolean;
}

export interface StudentFeedResponse {
  pair: {
    gender: StudentGender;
    student1: PublicStudentProfile;
    student2: PublicStudentProfile;
  } | null;
  allVoted: boolean;
  hasEnoughForFilter: boolean;
  auth: {
    isVerified: boolean;
    email: string | null;
    freeVotesUsed: number;
    freeVotesLimit: number;
    freeVotesRemaining: number | null;
    requiresAuth: boolean;
  };
  stats: {
    totalVotes: number;
    totalStudents: number;
    maleCount: number;
    femaleCount: number;
  };
  leaderboards: {
    overall: StudentLeaderboardItem[];
    female: StudentLeaderboardItem[];
    male: StudentLeaderboardItem[];
  };
}

export interface StudentVoteResponse {
  success: boolean;
  winner: PublicStudentProfile;
  loser: PublicStudentProfile;
  delta: number;
  auth: {
    isVerified: boolean;
    freeVotesUsed: number;
    freeVotesLimit: number;
    freeVotesRemaining: number | null;
    requiresAuth: boolean;
  };
}

export interface MyStudentSubmission {
  id: string;
  name: string;
  gender: StudentGender;
  photo: string;
  instagram: string | null;
  relationType: StudentRelationType;
  status: StudentModerationStatus;
  rejectionReason: string | null;
  eloRating: number;
  wins: number;
  winPercent: number;
  rank: number | null;
  createdAt: string;
}

export interface AdminStudentReport {
  id: string;
  profileId: string;
  reason: string;
  details: string | null;
  reporterEmail: string | null;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

export interface AdminStudentProfile {
  id: string;
  name: string;
  gender: StudentGender;
  photo: string;
  instagram: string | null;
  relationType: StudentRelationType;
  consentConfirmed: boolean;
  uploaderEmail: string;
  status: StudentModerationStatus;
  rejectionReason: string | null;
  eloRating: number;
  wins: number;
  losses: number;
  impressions: number;
  winPercent: number;
  openReportsCount: number;
  reports: AdminStudentReport[];
  createdAt: string;
}

export interface AdminStudentsListResponse {
  profiles: AdminStudentProfile[];
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    reported: number;
  };
}

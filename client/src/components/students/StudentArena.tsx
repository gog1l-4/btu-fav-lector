import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Crown,
  Flag,
  Heart,
  Info,
  Instagram,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import type {
  PublicStudentProfile,
  StudentFeedResponse,
  StudentFilter,
  StudentGender,
  StudentLeaderboardItem,
  StudentVoteResponse,
} from '../../types';
import {
  getStoredStudentFilter,
  getStudentEmail,
  setStoredStudentFilter,
  studentApiRequest,
} from '../../utils/studentAuth';
import { getOrCreateVoterId } from '../../utils/voterId';
import { BtuOtpModal } from './BtuOtpModal';
import { MyStudentsModal } from './MyStudentsModal';
import { StudentReportModal } from './StudentReportModal';
import { StudentUploadModal } from './StudentUploadModal';

interface StudentArenaProps {
  externalModal: 'rating' | 'stats' | 'about' | null;
  onCloseExternalModal: () => void;
  onAuthChange?: (email: string | null) => void;
  openAccountTrigger?: number;
}

function LaurelLeft() {
  return (
    <svg className="w-8 h-8 sm:w-11 sm:h-11 text-[#C8A97E]/80 flex-shrink-0" viewBox="0 0 48 48" fill="currentColor">
      <path d="M14 6c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm8 10c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm2 12c2 4 1 9-2 13-4-2-7-6-5-11 2-1 5-1 7-2zm-6 10c0 4-2 9-5 12-3-3-4-7-3-12 3 0 5 0 8 0z" />
    </svg>
  );
}

function LaurelRight() {
  return (
    <svg className="w-8 h-8 sm:w-11 sm:h-11 text-[#C8A97E]/80 flex-shrink-0 -scale-x-100" viewBox="0 0 48 48" fill="currentColor">
      <path d="M14 6c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm8 10c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm2 12c2 4 1 9-2 13-4-2-7-6-5-11 2-1 5-1 7-2zm-6 10c0 4-2 9-5 12-3-3-4-7-3-12 3 0 5 0 8 0z" />
    </svg>
  );
}

function StudentAvatar({ src, name, size = 'sm' }: { src: string; name: string; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const sizeClasses = size === 'sm' ? 'w-8 h-8 sm:w-10 sm:h-10 text-xs' : 'w-10 h-10 text-sm';

  if (!src || failed) {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('');
    return (
      <div
        className={`${sizeClasses} rounded-full bg-white/10 text-stone-300 font-bold flex items-center justify-center border border-white/10 flex-shrink-0 font-title`}
      >
        {initials || 'SU'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={`${sizeClasses} rounded-full object-cover object-top border border-white/10 flex-shrink-0`}
    />
  );
}

export const STUDENTS_FEED_CACHE_KEY = 'spaceuni_students_feed_v1';

function readCachedStudentsFeed(expectedFilter: StudentFilter): StudentFeedResponse | null {
  try {
    const raw = sessionStorage.getItem(STUDENTS_FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { filter?: StudentFilter; data?: StudentFeedResponse };
    if (parsed?.data && parsed.filter === expectedFilter) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

export function StudentArena({
  externalModal,
  onCloseExternalModal,
  onAuthChange,
  openAccountTrigger,
}: StudentArenaProps) {
  const [storedFilter] = useState<StudentFilter | null>(() => getStoredStudentFilter());
  const [filter, setFilter] = useState<StudentFilter>(storedFilter || 'ALL');
  const [needsInitialFilterPick, setNeedsInitialFilterPick] = useState<boolean>(!storedFilter);
  const [showFilterSettings, setShowFilterSettings] = useState(false);

  const [initialStudentCache] = useState<StudentFeedResponse | null>(() =>
    readCachedStudentsFeed(storedFilter || 'ALL')
  );
  const [feed, setFeed] = useState<StudentFeedResponse | null>(() => initialStudentCache);
  const [loading, setLoading] = useState(!initialStudentCache);
  const [voting, setVoting] = useState(false);
  const [justVoted, setJustVoted] = useState<{
    winnerId: string;
    student1Percent?: number;
    student2Percent?: number;
  } | null>(null);

  const [leaderboardTab, setLeaderboardTab] = useState<'overall' | 'female' | 'male'>('overall');
  const [localRatingModal, setLocalRatingModal] = useState(false);

  // Modals
  const [otpModal, setOtpModal] = useState<{ open: boolean; reason: 'vote_limit' | 'upload' | 'account' }>({
    open: false,
    reason: 'vote_limit',
  });
  const [pendingUploadAfterAuth, setPendingUploadAfterAuth] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [myModalOpen, setMyModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  const lastGenderRef = useRef<StudentGender | null>(null);
  const voterId = getOrCreateVoterId();
  const { socket } = useSocket();
  const { showToast } = useToast();

  const fetchFeedData = useCallback(
    async (overrideFilter?: StudentFilter): Promise<StudentFeedResponse> => {
      const activeFilter = overrideFilter ?? filter;
      const params = new URLSearchParams({
        filter: activeFilter,
        voterId,
      });
      if (lastGenderRef.current) {
        params.set('lastGender', lastGenderRef.current);
      }
      const data = await studentApiRequest<StudentFeedResponse>(`/feed?${params.toString()}`);
      try {
        sessionStorage.setItem(
          STUDENTS_FEED_CACHE_KEY,
          JSON.stringify({ filter: activeFilter, data })
        );
      } catch {
        // Ignore storage quota errors
      }
      return data;
    },
    [filter, voterId]
  );

  const loadFeed = useCallback(
    async (overrideFilter?: StudentFilter, silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await fetchFeedData(overrideFilter);
        setFeed(data);
        setJustVoted(null);
        if (data.pair?.gender) {
          lastGenderRef.current = data.pair.gender;
        }
        onAuthChange?.(data.auth.isVerified ? data.auth.email : null);
      } catch (err: any) {
        if (!silent) {
          showToast(err.message || 'სტუდენტების ჩატვირთვა ვერ მოხერხდა', 'error');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fetchFeedData, onAuthChange, showToast]
  );

  useEffect(() => {
    loadFeed(undefined, Boolean(feed));
  }, [filter]);

  // Listen to real-time updates via Socket.IO (refresh leaderboard & stats silently)
  useEffect(() => {
    if (!socket) return;
    const handleStudentUpdate = () => {
      // Only refresh silently if not mid-vote animation
      if (!voting && !justVoted) {
        loadFeed(undefined, true);
      }
    };
    socket.on('students:update', handleStudentUpdate);
    return () => {
      socket.off('students:update', handleStudentUpdate);
    };
  }, [socket, voting, justVoted, loadFeed]);

  // Trigger account modal from header user button
  useEffect(() => {
    if (!openAccountTrigger) return;
    const isVerified = feed?.auth.isVerified || Boolean(getStudentEmail());
    if (isVerified) {
      setMyModalOpen(true);
    } else {
      setOtpModal({ open: true, reason: 'account' });
    }
  }, [openAccountTrigger]);

  function handleSelectFilter(nextFilter: StudentFilter) {
    setFilter(nextFilter);
    setStoredStudentFilter(nextFilter);
    setNeedsInitialFilterPick(false);
    setShowFilterSettings(false);
    if (nextFilter === 'FEMALE') setLeaderboardTab('female');
    else if (nextFilter === 'MALE') setLeaderboardTab('male');
    else setLeaderboardTab('overall');
  }

  function handleUploadClick() {
    const isVerified = feed?.auth.isVerified || Boolean(getStudentEmail());
    if (!isVerified) {
      setPendingUploadAfterAuth(true);
      setOtpModal({ open: true, reason: 'upload' });
      return;
    }
    setUploadModalOpen(true);
  }

  async function handleVote(winner: PublicStudentProfile, loser: PublicStudentProfile) {
    if (!feed?.pair || voting || justVoted) return;

    if (feed.auth.requiresAuth) {
      setOtpModal({ open: true, reason: 'vote_limit' });
      return;
    }

    const activePair = feed.pair;

    // 0ms instant optimistic highlight + confetti on thumb tap!
    setJustVoted({ winnerId: winner.id });
    confetti({
      particleCount: 35,
      spread: 52,
      origin: { y: 0.65 },
      colors: ['#D8BE93', '#C8A97E', '#FFFFFF'],
    });

    try {
      setVoting(true);
      const res = await studentApiRequest<StudentVoteResponse>('/vote', {
        method: 'POST',
        body: JSON.stringify({
          winnerId: winner.id,
          loserId: loser.id,
          voterId,
        }),
      });

      const s1IsWinner = activePair.student1.id === winner.id;
      const s1WinPct = s1IsWinner ? res.winner.winPercent : res.loser.winPercent;
      const s2WinPct = s1IsWinner ? res.loser.winPercent : res.winner.winPercent;

      setJustVoted({
        winnerId: winner.id,
        student1Percent: s1WinPct,
        student2Percent: s2WinPct,
      });

      // Fetch the next pair IN PARALLEL with the short 450ms reveal animation
      const [nextData] = await Promise.all([
        fetchFeedData().catch(() => null),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ]);

      if (nextData) {
        setFeed(nextData);
        if (nextData.pair?.gender) {
          lastGenderRef.current = nextData.pair.gender;
        }
        onAuthChange?.(nextData.auth.isVerified ? nextData.auth.email : null);
      }
      setJustVoted(null);

      if (res.auth.requiresAuth) {
        setOtpModal({ open: true, reason: 'vote_limit' });
      }
    } catch (err: any) {
      setJustVoted(null);
      if (err?.code === 'BTU_AUTH_REQUIRED' || err?.status === 401) {
        setOtpModal({ open: true, reason: 'vote_limit' });
        return;
      }
      showToast(err.message || 'ხმის მიცემა ვერ მოხერხდა', 'error');
    } finally {
      setVoting(false);
    }
  }

  const activeLeaderboard: StudentLeaderboardItem[] =
    leaderboardTab === 'female'
      ? feed?.leaderboards.female || []
      : leaderboardTab === 'male'
      ? feed?.leaderboards.male || []
      : feed?.leaderboards.overall || [];

  const filterLabel =
    filter === 'MALE' ? 'ბიჭები' : filter === 'FEMALE' ? 'გოგოები' : 'ორივე';

  const isRatingModalOpen = localRatingModal || externalModal === 'rating';
  const isStatsModalOpen = externalModal === 'stats';
  const isAboutModalOpen = externalModal === 'about';

  function closeAllInfoModals() {
    setLocalRatingModal(false);
    onCloseExternalModal();
  }

  const pair = feed?.pair || null;
  const stats = feed?.stats || { totalVotes: 0, totalStudents: 0, maleCount: 0, femaleCount: 0 };
  const isVerified = feed?.auth.isVerified || false;

  return (
    <>
      {/* HERO SECTION */}
      <section className="relative z-10 pt-3 sm:pt-7 pb-4 sm:pb-6 px-4 text-center max-w-4xl mx-auto">
        <div className="inline-block tracking-widest uppercase text-[10px] sm:text-[11px] font-bold text-[#C8A97E] mb-2">
          BTU STUDENTS BATTLE
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-2 sm:mb-3">
          <LaurelLeft />
          <h1 className="text-xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight font-title">
            რომელია შენი ფავორიტი სტუდენტი?
          </h1>
          <LaurelRight />
        </div>

        <p className="text-stone-400 text-xs sm:text-sm md:text-base max-w-lg mx-auto font-normal mb-5 sm:mb-6">
          შეაფასე წყვილები, იხილე ტოპ რეიტინგი ან დაამატე შენი და მეგობრის ფოტო.
        </p>

        {/* 3 REAL STATS ROW */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6 max-w-xl mx-auto mb-5">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C8A97E] flex-shrink-0" />
            <div className="text-left">
              <div className="text-[11px] sm:text-sm font-bold text-white font-title">
                {stats.totalVotes.toLocaleString()}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-500 font-medium">სულ ხმები</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C8A97E] flex-shrink-0" />
            <div className="text-left">
              <div className="text-[11px] sm:text-sm font-bold text-white font-title">
                {stats.totalStudents}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-500 font-medium">მონაწილე</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C8A97E] flex-shrink-0" />
            <div className="text-left">
              <div className="text-[11px] sm:text-sm font-bold text-white font-title">
                {stats.femaleCount} / {stats.maleCount}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-500 font-medium">გოგო / ბიჭი</div>
            </div>
          </div>
        </div>

        {/* CONTROLS BAR: Filter Settings + Upload CTA + My Profile */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {/* Gender Filter Settings Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowFilterSettings((v) => !v)}
              className="px-3.5 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-xs font-semibold text-stone-200 flex items-center gap-2 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#D8BE93]" />
              <span>შეფასება: <strong className="text-[#E8D3AD]">{filterLabel}</strong></span>
            </button>

            {showFilterSettings && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 rounded-2xl bg-[#141720] border border-[#D8BE93]/25 shadow-2xl p-2 z-30 space-y-1 text-left">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  ვისი შეფასება გსურს?
                </div>
                {(
                  [
                    { id: 'ALL', label: 'ორივე (მონაცვლეობით)', sub: 'ბიჭები და გოგოები' },
                    { id: 'FEMALE', label: 'მხოლოდ გოგოები', sub: `${stats.femaleCount} მონაწილე` },
                    { id: 'MALE', label: 'მხოლოდ ბიჭები', sub: `${stats.maleCount} მონაწილე` },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectFilter(opt.id)}
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                      filter === opt.id
                        ? 'bg-[#D8BE93]/15 text-[#E8D3AD] font-bold border border-[#D8BE93]/35'
                        : 'text-stone-300 hover:bg-white/5'
                    }`}
                  >
                    <div>
                      <div>{opt.label}</div>
                      <div className="text-[10px] text-stone-500 font-normal">{opt.sub}</div>
                    </div>
                    {filter === opt.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#D8BE93]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Photo CTA */}
          <button
            onClick={handleUploadClick}
            className="px-4 py-2.5 rounded-full bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-[#D8BE93]/15 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>დაამატე ფოტო</span>
          </button>

          {/* My Uploads / BTU Profile Button */}
          {isVerified ? (
            <button
              onClick={() => setMyModalOpen(true)}
              className="px-3.5 py-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-[#D8BE93]/25 text-xs font-semibold text-[#E8D3AD] flex items-center gap-1.5 transition cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>ჩემი ფოტოები</span>
            </button>
          ) : (
            <button
              onClick={() => setOtpModal({ open: true, reason: 'account' })}
              className="px-3.5 py-2.5 rounded-full bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 text-xs font-semibold text-stone-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <Lock className="w-3 h-3 text-[#C8A97E]" />
              <span>BTU შესვლა</span>
            </button>
          )}
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-3 sm:px-6 py-2 sm:py-6 flex-1">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">
          {/* LEFT: STUDENT VERSUS ARENA */}
          <div className="w-full lg:flex-1 space-y-4 sm:space-y-5">
            {/* First-Visit Quick Gender Chooser */}
            {needsInitialFilterPick ? (
              <div className="rounded-3xl bg-[#11141C] border border-[#D8BE93]/25 p-6 sm:p-10 text-center space-y-6 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-[#D8BE93]/15 border border-[#D8BE93]/35 text-[#D8BE93] flex items-center justify-center mx-auto">
                  <SlidersHorizontal className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white font-title">
                    ვისი შეფასება გსურს?
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-400 max-w-sm mx-auto">
                    აირჩიე კატეგორია — მისი შეცვლა ნებისმიერ დროს შეგეძლება სეთინგებიდან.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                  <button
                    onClick={() => handleSelectFilter('FEMALE')}
                    className="py-4 px-4 rounded-2xl bg-white/[0.04] hover:bg-[#D8BE93]/15 border border-white/10 hover:border-[#D8BE93]/50 text-white font-bold text-sm transition cursor-pointer space-y-1"
                  >
                    <div className="font-title">გოგოები</div>
                    <div className="text-[11px] text-stone-400 font-normal">გოგო VS გოგო</div>
                  </button>

                  <button
                    onClick={() => handleSelectFilter('MALE')}
                    className="py-4 px-4 rounded-2xl bg-white/[0.04] hover:bg-[#D8BE93]/15 border border-white/10 hover:border-[#D8BE93]/50 text-white font-bold text-sm transition cursor-pointer space-y-1"
                  >
                    <div className="font-title">ბიჭები</div>
                    <div className="text-[11px] text-stone-400 font-normal">ბიჭი VS ბიჭი</div>
                  </button>

                  <button
                    onClick={() => handleSelectFilter('ALL')}
                    className="py-4 px-4 rounded-2xl bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 font-bold text-sm transition cursor-pointer space-y-1 shadow-lg shadow-[#D8BE93]/20"
                  >
                    <div className="font-title">ორივე ✨</div>
                    <div className="text-[11px] text-stone-800 font-normal">მონაცვლეობით</div>
                  </button>
                </div>
              </div>
            ) : loading && !feed ? (
              <div className="rounded-3xl bg-[#11141C] border border-white/[0.07] p-14 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-7 h-7 text-[#D8BE93] animate-spin" />
                <p className="text-xs text-stone-400">წყვილი იტვირთება...</p>
              </div>
            ) : !pair ? (
              /* Empty or All Voted State */
              <div className="rounded-3xl bg-[#11141C] border border-white/[0.08] p-8 sm:p-12 text-center space-y-5 shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-[#D8BE93]/15 border border-[#D8BE93]/30 text-[#D8BE93] flex items-center justify-center mx-auto">
                  {feed?.allVoted ? <CheckCircle2 className="w-7 h-7" /> : <Camera className="w-7 h-7" />}
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg sm:text-2xl font-black text-white font-title">
                    {feed?.allVoted
                      ? 'ყველა ხელმისაწვდომი წყვილი შეაფასე! 🎉'
                      : 'ამ კატეგორიაში ჯერ საკმარისი ფოტო არ არის'}
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto">
                    {feed?.allVoted
                      ? 'როგორც კი ახალი სტუდენტები დაემატებიან, ახალი წყვილები ავტომატურად გამოჩნდება. მანამდე შეგიძლია ატვირთო შენი ან მეგობრის ფოტო!'
                      : 'იყავი ერთ-ერთი პირველი! ატვირთე შენი ან მეგობრის ფოტო და დაიწყე სტუდენტების ბრძოლა.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    onClick={handleUploadClick}
                    className="px-5 py-3 rounded-full bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-[#D8BE93]/15"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ატვირთე ფოტო</span>
                  </button>
                  {filter !== 'ALL' && (
                    <button
                      onClick={() => handleSelectFilter('ALL')}
                      className="px-4 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 font-semibold text-xs transition cursor-pointer"
                    >
                      ყველა კატეგორიის ნახვა
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ACTIVE 2-COLUMN SIDE-BY-SIDE VERSUS CARDS */
              <div className="relative">
                {/* Soft Gate Blur Overlay after 3 Free Votes */}
                {feed?.auth.requiresAuth && (
                  <div className="absolute inset-0 z-30 rounded-3xl bg-[#0B0D12]/90 sm:bg-[#0B0D12]/80 sm:backdrop-blur-md border border-[#D8BE93]/35 flex flex-col items-center justify-center p-6 text-center space-y-4 shadow-2xl">
                    <div className="w-14 h-14 rounded-2xl bg-[#D8BE93]/15 border border-[#D8BE93]/40 text-[#D8BE93] flex items-center justify-center">
                      <Lock className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h3 className="text-lg sm:text-2xl font-black text-white font-title">
                        გააგრძელე BTU-ს მეილით
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                        შენ უკვე შეაფასე პირველი {feed.auth.freeVotesLimit} წყვილი! უსასრულო შეფასებისთვის და ფოტოს დასამატებლად დაადასტურე <span className="text-[#E8D3AD] font-semibold">@btu.edu.ge</span> — 15 წამში.
                      </p>
                    </div>
                    <button
                      onClick={() => setOtpModal({ open: true, reason: 'vote_limit' })}
                      className="px-6 py-3.5 rounded-full bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-xl shadow-[#D8BE93]/25 active:scale-95"
                    >
                      <span>ვერიფიკაცია @btu.edu.ge-ით</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className={`grid grid-cols-2 gap-2.5 sm:gap-6 relative ${feed?.auth.requiresAuth ? 'blur-sm pointer-events-none select-none opacity-60' : ''}`}>
                  {/* Center VS Medallion */}
                  <div className="absolute left-1/2 top-[43%] -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-13 sm:h-13 rounded-full bg-[#D8BE93] text-stone-900 font-black italic shadow-2xl flex items-center justify-center tracking-wider text-[10px] sm:text-sm pointer-events-none ring-2 sm:ring-4 ring-[#0B0D12]">
                    VS
                  </div>

                  {/* STUDENT 1 CARD */}
                  {[
                    {
                      student: pair.student1,
                      opponent: pair.student2,
                      side: 1 as const,
                      percent: justVoted?.student1Percent,
                    },
                    {
                      student: pair.student2,
                      opponent: pair.student1,
                      side: 2 as const,
                      percent: justVoted?.student2Percent,
                    },
                  ].map(({ student, opponent, side, percent }) => {
                    const isPicked = justVoted?.winnerId === student.id;
                    return (
                      <div key={student.id} className="space-y-2 sm:space-y-3">
                        <div
                          onClick={() => handleVote(student, opponent)}
                          className={`relative rounded-2xl sm:rounded-3xl overflow-hidden aspect-[3/4] bg-[#141720] border transition-all duration-300 shadow-2xl group cursor-pointer ${
                            isPicked
                              ? 'border-[#D8BE93] ring-2 ring-[#D8BE93]/50 scale-[1.01]'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          <img
                            src={student.photo}
                            alt={student.name}
                            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-102"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

                          {/* Discreet Report Flag Button */}
                          <button
                            type="button"
                            title="წაშლის მოთხოვნა / რეპორტი"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportTarget({ id: student.id, name: student.name });
                            }}
                            className="absolute top-2 right-2 sm:top-3.5 sm:right-3.5 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/55 hover:bg-black/80 border border-white/10 text-stone-400 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
                          >
                            <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>

                          {/* Post-vote Reveal Pill */}
                          {justVoted && typeof percent === 'number' && (
                            <div
                              className={`absolute top-2 left-2 sm:top-3.5 sm:left-3.5 z-10 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black font-title shadow-lg ${
                                isPicked
                                  ? 'bg-[#D8BE93] text-stone-950'
                                  : 'bg-black/70 text-stone-200 border border-white/15'
                              }`}
                            >
                              {percent}%
                            </div>
                          )}

                          {/* Name & Optional Instagram Overlay */}
                          <div className="absolute bottom-2.5 sm:bottom-5 left-2.5 sm:left-5 right-2.5 sm:right-5">
                            <h3 className="text-xs sm:text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-md font-title line-clamp-2">
                              {student.name}
                            </h3>
                            {student.instagram && (
                              <a
                                href={`https://instagram.com/${student.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-[#E8D3AD] hover:text-white transition truncate max-w-full"
                              >
                                <Instagram className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">@{student.instagram}</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Vote Button */}
                        <button
                          onClick={() => handleVote(student, opponent)}
                          disabled={voting || Boolean(justVoted)}
                          className={`w-full py-2.5 sm:py-3.5 px-2 sm:px-5 rounded-full font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 active:scale-98 cursor-pointer ${
                            isPicked
                              ? 'bg-[#D8BE93] text-stone-950 shadow-lg shadow-[#D8BE93]/25'
                              : side === 2
                              ? 'bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 shadow-md shadow-[#D8BE93]/20'
                              : 'bg-white/[0.04] hover:bg-white/[0.1] border border-white/15 text-white'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                              isPicked || side === 2
                                ? 'fill-stone-950 text-stone-950'
                                : 'text-[#D8BE93]'
                            }`}
                          />
                          <span className="truncate">
                            {isPicked ? 'არჩეულია ✨' : 'აირჩიე ეს სტუდენტი'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Soft Gate Progress & Skip Bar */}
                <div className="flex items-center justify-between pt-3 sm:pt-4 gap-2">
                  {!isVerified && feed && feed.auth.freeVotesRemaining !== null ? (
                    <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#C8A97E]" />
                      <span>
                        უფასო შეფასებები: <strong className="text-white">{feed.auth.freeVotesUsed} / {feed.auth.freeVotesLimit}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>BTU ვერიფიცირებული</span>
                    </div>
                  )}

                  <button
                    onClick={() => loadFeed()}
                    disabled={loading || voting}
                    className="px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] sm:text-xs font-semibold text-stone-300 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>გამოტოვება</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: POSITIVE TOP STUDENTS LEADERBOARD */}
          <aside className="w-full lg:w-[340px] flex-shrink-0 rounded-3xl bg-[#11141C] border border-white/[0.07] p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#C8A97E] flex-shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white leading-tight font-title">
                    ტოპ სტუდენტები
                  </h2>
                  <p className="text-[11px] text-stone-500">ყველაზე ხშირად არჩეულები</p>
                </div>
              </div>

              <button
                onClick={() => setLocalRatingModal(true)}
                className="text-[11px] sm:text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              >
                <span>სრული</span>
                <span>→</span>
              </button>
            </div>

            {/* Leaderboard Gender Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#0B0D12] border border-white/[0.06]">
              {(
                [
                  { id: 'overall', label: 'საერთო' },
                  { id: 'female', label: 'გოგოები' },
                  { id: 'male', label: 'ბიჭები' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLeaderboardTab(tab.id)}
                  className={`py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    leaderboardTab === tab.id
                      ? 'bg-[#D8BE93] text-stone-950'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Top 5 Positive Ranked List */}
            <div className="space-y-3">
              {activeLeaderboard.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">
                  რეიტინგი ჯერ ცარიელია — დაამატე პირველი ფოტო!
                </div>
              ) : (
                activeLeaderboard.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-1.5 sm:p-2 rounded-2xl hover:bg-white/[0.03] transition"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-black flex-shrink-0 font-title ${
                          item.rank === 1
                            ? 'bg-[#D8BE93] text-stone-950'
                            : item.rank === 2
                            ? 'bg-stone-300 text-stone-900'
                            : item.rank === 3
                            ? 'bg-[#B8865A] text-white'
                            : 'bg-white/10 text-stone-400'
                        }`}
                      >
                        {item.rank}
                      </div>

                      <StudentAvatar src={item.photo} name={item.name} size="sm" />

                      <div className="truncate">
                        <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate font-title">
                          <span className="truncate">{item.name}</span>
                          {item.isCrown && (
                            <Crown className="w-3.5 h-3.5 text-[#D8BE93] fill-[#D8BE93] flex-shrink-0" />
                          )}
                        </div>
                        {item.instagram ? (
                          <a
                            href={`https://instagram.com/${item.instagram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#C8A97E] hover:underline truncate block"
                          >
                            @{item.instagram}
                          </a>
                        ) : (
                          <div className="text-[10px] text-stone-500">
                            {item.gender === 'FEMALE' ? 'BTU სტუდენტი' : 'BTU სტუდენტი'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs sm:text-sm font-bold text-stone-300 flex-shrink-0 font-title">
                      {item.winPercent}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* INFO MODALS (Top 20 Rating / Stats / About for Students) */}
      {(isRatingModalOpen || isStatsModalOpen || isAboutModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 sm:backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#12151D] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D8BE93]">
                  {isRatingModalOpen && <Trophy className="w-5 h-5" />}
                  {isStatsModalOpen && <BarChart3 className="w-5 h-5" />}
                  {isAboutModalOpen && <Info className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-title">
                    {isRatingModalOpen && 'ტოპ 20 სტუდენტი'}
                    {isStatsModalOpen && 'სტუდენტების სტატისტიკა'}
                    {isAboutModalOpen && 'spaceuni სტუდენტების ბრძოლა'}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {isRatingModalOpen && 'Elo ალგორითმზე დაფუძნებული ცოცხალი რეიტინგი'}
                    {isStatsModalOpen && 'BTU-ს სტუდენტების რეალური მონაცემები'}
                    {isAboutModalOpen && 'სამართლიანი და დაცული სტუდენტური პლატფორმა'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeAllInfoModals}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isRatingModalOpen && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#0B0D12] border border-white/[0.06]">
                  {(
                    [
                      { id: 'overall', label: 'საერთო' },
                      { id: 'female', label: 'გოგოები' },
                      { id: 'male', label: 'ბიჭები' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLeaderboardTab(tab.id)}
                      className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        leaderboardTab === tab.id
                          ? 'bg-[#D8BE93] text-stone-950'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                  {activeLeaderboard.length === 0 ? (
                    <div className="py-8 text-center text-xs text-stone-500">
                      რეიტინგი ჯერ ცარიელია
                    </div>
                  ) : (
                    activeLeaderboard.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 font-title ${
                              item.rank === 1
                                ? 'bg-[#D8BE93] text-stone-950'
                                : item.rank === 2
                                ? 'bg-stone-300 text-stone-900'
                                : item.rank === 3
                                ? 'bg-[#B8865A] text-white'
                                : 'bg-white/10 text-stone-300'
                            }`}
                          >
                            {item.rank}
                          </div>
                          <StudentAvatar src={item.photo} name={item.name} size="md" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate font-title">
                              <span className="truncate">{item.name}</span>
                              {item.isCrown && <Crown className="w-3.5 h-3.5 text-[#D8BE93] fill-[#D8BE93]" />}
                            </div>
                            {item.instagram ? (
                              <a
                                href={`https://instagram.com/${item.instagram}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#D8BE93] hover:underline"
                              >
                                @{item.instagram}
                              </a>
                            ) : (
                              <div className="text-xs text-stone-400">BTU სტუდენტი</div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-black text-[#D8BE93] font-title flex-shrink-0">
                          {item.winPercent}%
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {isStatsModalOpen && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-white font-title">{stats.totalVotes.toLocaleString()}</div>
                    <div className="text-xs text-stone-400 mt-1">სულ მიცემული ხმა</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-white font-title">{stats.totalStudents}</div>
                    <div className="text-xs text-stone-400 mt-1">დადასტურებული სტუდენტი</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-[#D8BE93] font-title">{stats.femaleCount}</div>
                    <div className="text-xs text-stone-400 mt-1">გოგო მონაწილე</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-[#D8BE93] font-title">{stats.maleCount}</div>
                    <div className="text-xs text-stone-400 mt-1">ბიჭი მონაწილე</div>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#D8BE93]/10 border border-[#D8BE93]/20 flex items-center gap-2.5 text-xs text-[#D8BE93]">
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <span>სამართლიანი Elo რეიტინგი — ახალდამატებულებსაც თანაბარი შანსი აქვთ ტოპში მოხვედრის!</span>
                </div>
              </div>
            )}

            {isAboutModalOpen && (
              <div className="space-y-3 text-xs sm:text-sm text-stone-300 leading-relaxed">
                <p>
                  <strong>spaceuni</strong>-ს სტუდენტების ბრძოლაში თითოეულ BTU სტუდენტს შეუძლია დაამატოს საკუთარი ან მეგობრის ფოტო (თანხმობით).
                </p>
                <div className="space-y-2 pt-1">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D8BE93] mt-0.5 flex-shrink-0" />
                    <span><strong>მოდერაცია და კონტროლი:</strong> ყველა ფოტო გადის ადმინის შემოწმებას. ნებისმიერ დროს შესაძლებელია ფოტოს წაშლა ან დარეპორტება.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#D8BE93] mt-0.5 flex-shrink-0" />
                    <span><strong>Elo რეიტინგი:</strong> ლიდერბორდში ჩანს მხოლოდ ტოპ პოზიციები — პოზიტიური და სამართლიანი შეფასება.</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={closeAllInfoModals}
              className="w-full py-3 rounded-2xl bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 font-bold text-xs transition cursor-pointer"
            >
              დახურვა
            </button>
          </div>
        </div>
      )}

      {/* MODALS */}
      <BtuOtpModal
        isOpen={otpModal.open}
        reason={otpModal.reason}
        onClose={() => {
          setOtpModal((prev) => ({ ...prev, open: false }));
          setPendingUploadAfterAuth(false);
        }}
        onSuccess={(email) => {
          onAuthChange?.(email);
          loadFeed();
          if (pendingUploadAfterAuth) {
            setPendingUploadAfterAuth(false);
            setUploadModalOpen(true);
          }
        }}
      />

      <StudentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSubmitted={() => loadFeed(undefined, true)}
        onRequireAuth={() => {
          setUploadModalOpen(false);
          setPendingUploadAfterAuth(true);
          setOtpModal({ open: true, reason: 'upload' });
        }}
      />

      <MyStudentsModal
        isOpen={myModalOpen}
        onClose={() => setMyModalOpen(false)}
        onOpenUpload={() => setUploadModalOpen(true)}
        onLoggedOut={() => {
          onAuthChange?.(null);
          loadFeed();
        }}
        onDeleted={() => loadFeed(undefined, true)}
      />

      <StudentReportModal
        profile={reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </>
  );
}

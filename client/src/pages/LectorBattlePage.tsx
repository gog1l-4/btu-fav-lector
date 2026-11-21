import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Crown,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  Info,
  Landmark,
  Share2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Swords,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import type { BattleFeedResponse, LeaderboardItem, LectorBattle } from '../types';
import { getOrCreateVoterId } from '../utils/voterId';

function cleanPhotoUrl(url?: string | null): string {
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

function LeaderboardAvatar({ src, name, size = 'sm' }: { src: string; name: string; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const clean = cleanPhotoUrl(src);
  const sizeClasses = size === 'sm' ? 'w-8 h-8 sm:w-10 sm:h-10 text-xs' : 'w-10 h-10 text-sm';

  if (!clean || failed) {
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('');
    return (
      <div
        className={`${sizeClasses} rounded-full bg-white/10 text-stone-300 font-bold flex items-center justify-center border border-white/10 flex-shrink-0 font-title`}
      >
        {initials || 'UG'}
      </div>
    );
  }

  return (
    <img
      src={clean}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClasses} rounded-full object-cover border border-white/10 flex-shrink-0`}
    />
  );
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

export function LectorBattlePage() {
  const [battles, setBattles] = useState<(LectorBattle & { hasVoted?: boolean; userVote?: number | null })[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({
    totalVotes: 0,
    totalBattles: 0,
    totalLectors: 0,
    university: 'BTU',
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  // Tab & Modal views
  const [activeTab, setActiveTab] = useState<'main' | 'rating' | 'stats' | 'about'>('main');
  const [modalView, setModalView] = useState<'rating' | 'stats' | 'about' | null>(null);

  const { socket } = useSocket();
  const { showToast } = useToast();
  const voterId = getOrCreateVoterId();

  // 1. Fetch real feed data
  useEffect(() => {
    async function loadFeed() {
      try {
        setLoading(true);
        const data = await apiRequest<BattleFeedResponse>(`/battles/feed?voterId=${voterId}`);
        if (data.battles && data.battles.length > 0) {
          setBattles(data.battles);
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      } catch (err: any) {
        showToast(err.message || 'მონაცემების ჩატვირთვა ვერ მოხერხდა', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, [voterId]);

  // Current battle
  const currentBattle = battles[currentIndex] || battles[0] || null;

  // 2. Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleBattleUpdate = (updatedBattle: LectorBattle) => {
      setBattles((prev) =>
        prev.map((b) => (b.id === updatedBattle.id ? { ...b, ...updatedBattle } : b))
      );
      // Also update total votes dynamically
      setStats((prev) => ({
        ...prev,
        totalVotes: prev.totalVotes + 1,
      }));
    };

    socket.on('battle:update', handleBattleUpdate);

    return () => {
      socket.off('battle:update', handleBattleUpdate);
    };
  }, [socket]);

  // 3. Handle Voting
  async function handleVote(lectorNumber: 1 | 2) {
    if (!currentBattle || voting || currentBattle.hasVoted) return;

    try {
      setVoting(true);
      const res = await apiRequest<{
        success: boolean;
        battle: LectorBattle;
        hasVoted: boolean;
        userVote: number;
      }>(`/battles/${currentBattle.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          selectedLector: lectorNumber,
          voterId,
        }),
      });

      // Update battle locally
      setBattles((prev) =>
        prev.map((b) =>
          b.id === currentBattle.id
            ? { ...b, ...res.battle, hasVoted: true, userVote: lectorNumber }
            : b
        )
      );

      // Gold celebratory confetti
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#D8BE93', '#C8A97E', '#FFFFFF', '#E7D0AB'],
      });

      showToast('არჩევანი მიღებულია! ✨', 'success');
    } catch (err: any) {
      showToast(err.message || 'ხმის მიცემა ვერ მოხერხდა', 'error');
    } finally {
      setVoting(false);
    }
  }

  // 4. Pair navigation
  function handleNextPair() {
    if (battles.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % battles.length);
  }

  function handleRandomPair() {
    if (battles.length <= 1) return;
    let nextIdx = Math.floor(Math.random() * battles.length);
    if (nextIdx === currentIndex) {
      nextIdx = (currentIndex + 1) % battles.length;
    }
    setCurrentIndex(nextIdx);
  }

  // 5. Share link
  function handleShareLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('ლინკი დაკოპირდა! გაუგზავნე მეგობრებს 🚀', 'success');
    }
  }

  // Handle Tab Click
  function handleTabClick(tab: 'main' | 'rating' | 'stats' | 'about') {
    setActiveTab(tab);
    if (tab === 'main') {
      setModalView(null);
    } else {
      setModalView(tab);
    }
  }

  if (loading && !currentBattle) {
    return (
      <div className="min-h-screen bg-[#0B0D12] flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-full bg-[#181B24] border border-[#C8A97E]/30 flex items-center justify-center animate-pulse">
          <GraduationCap className="w-7 h-7 text-[#D8BE93] animate-bounce" />
        </div>
        <p className="mt-4 text-stone-400 font-medium text-xs tracking-wider uppercase">
          Fav Lector იტვირთება...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-stone-100 flex flex-col selection:bg-[#C8A97E] selection:text-stone-950 overflow-x-hidden font-sans">
      {/* Subtle Warm Ambient Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-[#C8A97E]/[0.04] via-[#1A1D27]/20 to-transparent blur-[140px]" />
      </div>

      {/* TOP HEADER NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#0B0D12]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-20 flex items-center justify-between">
          {/* Left Brand */}
          <div
            onClick={() => handleTabClick('main')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="font-extrabold text-white text-base sm:text-lg tracking-tight font-title">
              Fav Lector
            </span>
          </div>

          {/* Desktop Center Navigation Pills */}
          <nav className="hidden md:flex items-center bg-[#141720]/80 border border-white/[0.08] p-1 rounded-full shadow-inner">
            <button
              onClick={() => handleTabClick('main')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'main'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>მთავარი</span>
            </button>
            <button
              onClick={() => handleTabClick('rating')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'rating'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-[#C8A97E]" />
              <span>რეიტინგი</span>
            </button>
            <button
              onClick={() => handleTabClick('stats')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>სტატისტიკა</span>
            </button>
            <button
              onClick={() => handleTabClick('about')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'about'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>შესახებ</span>
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-stone-200">
              <Landmark className="w-3.5 h-3.5 text-[#C8A97E]" />
              <span>BTU</span>
              <ChevronDown className="w-3 h-3 text-stone-500" />
            </div>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-stone-300">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>

        {/* Mobile Navigation Pills Bar (1:1 with Mobile Mockup) */}
        <div className="md:hidden px-3 pb-2.5 pt-0.5 border-t border-white/[0.04]">
          <nav className="flex items-center justify-between gap-1 py-1">
            <button
              onClick={() => handleTabClick('main')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'main'
                  ? 'bg-white/10 text-white border border-white/10 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Home className="w-3 h-3" />
              <span>მთავარი</span>
            </button>
            <button
              onClick={() => handleTabClick('rating')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'rating'
                  ? 'bg-white/10 text-white border border-white/10 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3 h-3 text-[#C8A97E]" />
              <span>რეიტინგი</span>
            </button>
            <button
              onClick={() => handleTabClick('stats')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'bg-white/10 text-white border border-white/10 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span>სტატისტიკა</span>
            </button>
            <button
              onClick={() => handleTabClick('about')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'about'
                  ? 'bg-white/10 text-white border border-white/10 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Info className="w-3 h-3" />
              <span>შესახებ</span>
            </button>
          </nav>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-4 sm:pt-12 pb-4 sm:pb-6 px-4 text-center max-w-4xl mx-auto">
        <div className="inline-block tracking-widest uppercase text-[10px] sm:text-[11px] font-bold text-[#C8A97E] mb-2 sm:mb-3">
          BTU BATTLE
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-2 sm:mb-3">
          <LaurelLeft />
          <h1 className="text-xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight font-title">
            რომელია შენი ფავორიტი ლექტორი?
          </h1>
          <LaurelRight />
        </div>

        <p className="text-stone-400 text-xs sm:text-sm md:text-base max-w-lg mx-auto font-normal mb-5 sm:mb-8">
          აირჩიე ერთ-ერთი ლექტორი და გააგრძელე წყვილები.
        </p>

        {/* 3 REAL STATS ROW */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6 max-w-xl mx-auto">
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
            <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C8A97E] flex-shrink-0" />
            <div className="text-left">
              <div className="text-[11px] sm:text-sm font-bold text-white font-title">
                {stats.totalBattles.toLocaleString()}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-500 font-medium">ბრძოლა</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C8A97E] flex-shrink-0" />
            <div className="text-left">
              <div className="text-[11px] sm:text-sm font-bold text-white font-title">
                {stats.totalLectors}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-500 font-medium">ლექტორი</div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-3 sm:px-6 py-2 sm:py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">
          {/* LEFT: VERSUS ARENA */}
          <div className="w-full lg:flex-1 space-y-4 sm:space-y-6">
            {/* Cards Container: ALWAYS 2 COLUMNS (SIDE BY SIDE ON MOBILE) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-6 relative">
              {/* Center VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-13 sm:h-13 rounded-full bg-[#D8BE93] text-stone-900 font-black italic shadow-2xl flex items-center justify-center tracking-wider text-[10px] sm:text-sm pointer-events-none ring-2 sm:ring-4 ring-[#0B0D12]">
                VS
              </div>

              {/* LECTURER 1 CARD */}
              <div className="space-y-2 sm:space-y-3">
                <div
                  onClick={() => handleVote(1)}
                  className={`relative rounded-2xl sm:rounded-3xl overflow-hidden aspect-[3/4] sm:aspect-[3/4] bg-[#141720] border transition-all duration-300 shadow-2xl group cursor-pointer ${
                    currentBattle?.userVote === 1
                      ? 'border-[#D8BE93] ring-2 ring-[#D8BE93]/40'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={cleanPhotoUrl(currentBattle?.lector1Photo)}
                    alt={currentBattle?.lector1Name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

                  {/* Name & Subject Overlay */}
                  <div className="absolute bottom-2.5 sm:bottom-5 left-2.5 sm:left-5 right-2.5 sm:right-5">
                    <h3 className="text-xs sm:text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-md font-title line-clamp-2">
                      {currentBattle?.lector1Name}
                    </h3>
                    <p className="text-[10px] sm:text-sm text-stone-300 font-medium mt-0.5 sm:mt-1 truncate">
                      {currentBattle?.lector1Subject}
                    </p>
                  </div>

                  {currentBattle?.userVote === 1 && (
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-[#D8BE93] text-stone-950 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold flex items-center gap-1 shadow-lg">
                      <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">შენი არჩევანი</span>
                    </div>
                  )}
                </div>

                {/* Vote Button 1 */}
                <button
                  onClick={() => handleVote(1)}
                  disabled={voting || currentBattle?.hasVoted}
                  className={`w-full py-2.5 sm:py-3.5 px-2 sm:px-5 rounded-full font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 active:scale-98 shadow-md cursor-pointer ${
                    currentBattle?.userVote === 1
                      ? 'bg-[#D8BE93] text-stone-900 shadow-[#D8BE93]/20'
                      : currentBattle?.hasVoted
                      ? 'bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed'
                      : 'bg-[#151821] hover:bg-[#1E2230] border border-white/15 text-white'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                      currentBattle?.userVote === 1 ? 'fill-stone-900 text-stone-900' : 'text-stone-300'
                    }`}
                  />
                  <span className="truncate">
                    {currentBattle?.userVote === 1
                      ? 'არჩეულია'
                      : currentBattle?.hasVoted
                      ? 'ხმა მიცემულია'
                      : 'აირჩიე ეს ლექტორი'}
                  </span>
                </button>
              </div>

              {/* LECTURER 2 CARD */}
              <div className="space-y-2 sm:space-y-3">
                <div
                  onClick={() => handleVote(2)}
                  className={`relative rounded-2xl sm:rounded-3xl overflow-hidden aspect-[3/4] sm:aspect-[3/4] bg-[#141720] border transition-all duration-300 shadow-2xl group cursor-pointer ${
                    currentBattle?.userVote === 2
                      ? 'border-[#D8BE93] ring-2 ring-[#D8BE93]/40'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={cleanPhotoUrl(currentBattle?.lector2Photo)}
                    alt={currentBattle?.lector2Name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

                  {/* Name & Subject Overlay */}
                  <div className="absolute bottom-2.5 sm:bottom-5 left-2.5 sm:left-5 right-2.5 sm:right-5">
                    <h3 className="text-xs sm:text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-md font-title line-clamp-2">
                      {currentBattle?.lector2Name}
                    </h3>
                    <p className="text-[10px] sm:text-sm text-stone-300 font-medium mt-0.5 sm:mt-1 truncate">
                      {currentBattle?.lector2Subject}
                    </p>
                  </div>

                  {currentBattle?.userVote === 2 && (
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-[#D8BE93] text-stone-950 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold flex items-center gap-1 shadow-lg">
                      <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">შენი არჩევანი</span>
                    </div>
                  )}
                </div>

                {/* Vote Button 2 */}
                <button
                  onClick={() => handleVote(2)}
                  disabled={voting || currentBattle?.hasVoted}
                  className={`w-full py-2.5 sm:py-3.5 px-2 sm:px-5 rounded-full font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 active:scale-98 shadow-md cursor-pointer ${
                    currentBattle?.userVote === 2
                      ? 'bg-[#D8BE93] text-stone-900 shadow-[#D8BE93]/20'
                      : currentBattle?.hasVoted
                      ? 'bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed'
                      : 'bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-900 shadow-[#D8BE93]/20'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                      currentBattle?.userVote === 2 ? 'fill-stone-900 text-stone-900' : 'fill-stone-900'
                    }`}
                  />
                  <span className="truncate">
                    {currentBattle?.userVote === 2
                      ? 'არჩეულია'
                      : currentBattle?.hasVoted
                      ? 'ხმა მიცემულია'
                      : 'აირჩიე ეს ლექტორი'}
                  </span>
                </button>
              </div>
            </div>

            {/* Pagination & Pair Controls */}
            <div className="flex items-center justify-between pt-1 sm:pt-2">
              <button
                onClick={handleRandomPair}
                className="px-3 sm:px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] sm:text-xs font-semibold text-stone-300 transition flex items-center gap-1.5 sm:gap-2 active:scale-95 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#C8A97E]" />
                <span className="truncate">შემთხვევითი წყვილი</span>
              </button>

              <div className="text-xs font-bold text-stone-400 font-title">
                {currentIndex + 1} / {Math.max(battles.length, 1)}
              </div>

              <button
                onClick={handleNextPair}
                className="px-3 sm:px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] sm:text-xs font-semibold text-stone-300 transition flex items-center gap-1.5 sm:gap-2 active:scale-95 cursor-pointer"
              >
                <span>შემდეგი წყვილი</span>
                <span>→</span>
              </button>
            </div>

            {/* PROGRESS BAR - PLACED DIRECTLY BELOW CONTROLS AS IN MOBILE MOCKUP */}
            {currentBattle && (
              <div className="bg-[#13161F]/90 border border-white/[0.08] rounded-2xl p-3 sm:px-6 sm:py-3.5 flex flex-col gap-2.5 shadow-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-300">
                  <BarChart3 className="w-4 h-4 text-[#D8BE93]" />
                  <span className="font-title">ბრძოლის პროგრესი</span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 w-full">
                  <div className="text-[11px] sm:text-xs font-bold text-[#D8BE93] whitespace-nowrap font-title flex items-center gap-1">
                    <span>{currentBattle.lector1Percent}%</span>
                    <span className="text-[10px] text-stone-400 font-normal truncate max-w-[80px] sm:max-w-none">
                      {currentBattle.lector1Name}
                    </span>
                  </div>

                  {/* Dual Color Progress Bar */}
                  <div className="flex-1 h-2 sm:h-3 bg-[#242A38] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#D8BE93] transition-all duration-700 ease-out"
                      style={{ width: `${currentBattle.lector1Percent}%` }}
                    />
                    <div
                      className="h-full bg-[#353D50] transition-all duration-700 ease-out"
                      style={{ width: `${currentBattle.lector2Percent}%` }}
                    />
                  </div>

                  <div className="text-[11px] sm:text-xs font-bold text-stone-300 whitespace-nowrap font-title flex items-center gap-1">
                    <span className="text-[10px] text-stone-400 font-normal truncate max-w-[80px] sm:max-w-none">
                      {currentBattle.lector2Name}
                    </span>
                    <span>{currentBattle.lector2Percent}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT / BELOW: LEADERBOARD SIDEBAR */}
          <aside className="w-full lg:w-[350px] xl:w-[380px] bg-[#13161F]/90 border border-white/[0.08] rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D8BE93]">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white leading-tight font-title">
                    ტოპ ლექტორები
                  </h2>
                  <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5">
                    ყველაზე ხშირად არჩეულები
                  </p>
                </div>
              </div>

              {/* Full Rating Link on Right Side of Header */}
              <button
                onClick={() => handleTabClick('rating')}
                className="text-[11px] sm:text-xs font-semibold text-stone-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
              >
                <span>სრული რეიტინგი</span>
                <span>→</span>
              </button>
            </div>

            {/* Ranked List */}
            <div className="space-y-3 sm:space-y-4">
              {leaderboard.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500">
                  რეიტინგი ჯერ ცარიელია
                </div>
              ) : (
                leaderboard.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-1.5 sm:p-2 rounded-2xl hover:bg-white/[0.03] transition"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      {/* Rank Circle */}
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

                      {/* Avatar */}
                      <LeaderboardAvatar src={item.avatar} name={item.name} size="sm" />

                      {/* Name */}
                      <div className="truncate">
                        <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate font-title">
                          <span className="truncate">{item.name}</span>
                          {item.isCrown && (
                            <Crown className="w-3.5 h-3.5 text-[#D8BE93] fill-[#D8BE93] flex-shrink-0" />
                          )}
                        </div>
                        {item.subject && (
                          <div className="text-[10px] text-stone-400 truncate">
                            {item.subject}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Percentage */}
                    <div className="text-xs sm:text-sm font-bold text-stone-300 flex-shrink-0 font-title">
                      {item.percent}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] bg-[#0A0C10] py-6 text-center text-xs text-stone-500 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Fav Lector • BTU minimal premium platform</p>
          <div className="flex items-center gap-2 text-stone-500">
            <Sparkles className="w-3.5 h-3.5 text-[#C8A97E]" />
            <span>ხმები განახლდება რეალურ დროში</span>
          </div>
        </div>
      </footer>

      {/* MODAL WINDOWS FOR: რეიტინგი, სტატისტიკა, შესახებ (100% REAL!) */}
      {modalView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#12151D] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D8BE93]">
                  {modalView === 'rating' && <Trophy className="w-5 h-5" />}
                  {modalView === 'stats' && <BarChart3 className="w-5 h-5" />}
                  {modalView === 'about' && <Info className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-title">
                    {modalView === 'rating' && 'სრული რეიტინგი'}
                    {modalView === 'stats' && 'პლატფორმის სტატისტიკა'}
                    {modalView === 'about' && 'Fav Lector-ის შესახებ'}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {modalView === 'rating' && 'BTU-ს ლექტორების ცოცხალი რეიტინგი'}
                    {modalView === 'stats' && 'სტუდენტური ხმებისა და ბრძოლების მონაცემები'}
                    {modalView === 'about' && 'სტუდენტური ინოვაციური პლატფორმა'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setModalView(null);
                  setActiveTab('main');
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - Rating View */}
            {modalView === 'rating' && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {leaderboard.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-500">
                    რეიტინგი ჯერ ცარიელია
                  </div>
                ) : (
                  leaderboard.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black font-title ${
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
                        <LeaderboardAvatar src={item.avatar} name={item.name} size="md" />
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-1.5 font-title">
                            <span>{item.name}</span>
                            {item.isCrown && <Crown className="w-3.5 h-3.5 text-[#D8BE93] fill-[#D8BE93]" />}
                          </div>
                          <div className="text-xs text-stone-400">{item.subject || 'BTU ლექტორი'}</div>
                        </div>
                      </div>
                      <div className="text-sm font-black text-[#D8BE93] font-title">
                        {item.percent}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Modal Body - Stats View */}
            {modalView === 'stats' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-white font-title">{stats.totalVotes.toLocaleString()}</div>
                    <div className="text-xs text-stone-400 mt-1">დაფიქსირებული ხმა</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-white font-title">{stats.totalBattles.toLocaleString()}</div>
                    <div className="text-xs text-stone-400 mt-1">აქტიური ბრძოლა</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-white font-title">{stats.totalLectors}</div>
                    <div className="text-xs text-stone-400 mt-1">დარეგისტრირებული ლექტორი</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-2xl font-black text-[#D8BE93] font-title">100%</div>
                    <div className="text-xs text-stone-400 mt-1">ანონიმური და ობიექტური</div>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#D8BE93]/10 border border-[#D8BE93]/20 flex items-center gap-2.5 text-xs text-[#D8BE93]">
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <span>ხმები ითვლება რეალურ დროში და განახლდება ყოველ წამს.</span>
                </div>
              </div>
            )}

            {/* Modal Body - About View */}
            {modalView === 'about' && (
              <div className="space-y-3.5 text-xs sm:text-sm text-stone-300 leading-relaxed">
                <p>
                  <strong>Fav Lector</strong> არის სტუდენტებისთვის შექმნილი პლატფორმა, სადაც მარტივად, პირისპირ ბრძოლებით (Head-to-Head Versus) ირჩევა BTU-ს საყვარელი ლექტორი.
                </p>
                <div className="space-y-2 pt-2">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D8BE93] mt-0.5 flex-shrink-0" />
                    <span><strong>100% ანონიმური ხმის მიცემა:</strong> სისტემა იცავს სტუდენტის კონფიდენციალურობას.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#D8BE93] mt-0.5 flex-shrink-0" />
                    <span><strong>ცოცხალი რეიტინგი:</strong> შედეგები ითვლება პირდაპირ ეთერში Socket.IO-ს მეშვეობით.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setModalView(null);
                  setActiveTab('main');
                }}
                className="w-full py-3 rounded-2xl bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 font-bold text-xs transition cursor-pointer"
              >
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default LectorBattlePage;

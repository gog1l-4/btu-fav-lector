import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Crown,
  GraduationCap,
  Heart,
  Landmark,
  RefreshCw,
  Share2,
  Shuffle,
  Sparkles,
  Swords,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import type { BattleFeedResponse, LeaderboardItem, LectorBattle } from '../types';
import { getOrCreateVoterId } from '../utils/voterId';

function LaurelLeft() {
  return (
    <svg className="w-8 h-8 sm:w-11 sm:h-11 text-[#C8A97E]/75 flex-shrink-0" viewBox="0 0 48 48" fill="currentColor">
      <path d="M14 6c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm8 10c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm2 12c2 4 1 9-2 13-4-2-7-6-5-11 2-1 5-1 7-2zm-6 10c0 4-2 9-5 12-3-3-4-7-3-12 3 0 5 0 8 0z" />
    </svg>
  );
}

function LaurelRight() {
  return (
    <svg className="w-8 h-8 sm:w-11 sm:h-11 text-[#C8A97E]/75 flex-shrink-0 -scale-x-100" viewBox="0 0 48 48" fill="currentColor">
      <path d="M14 6c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm8 10c3 4 3 9 0 14-4-2-7-7-6-12 2-1 4-1 6-2zm2 12c2 4 1 9-2 13-4-2-7-6-5-11 2-1 5-1 7-2zm-6 10c0 4-2 9-5 12-3-3-4-7-3-12 3 0 5 0 8 0z" />
    </svg>
  );
}

export function LectorBattlePage() {
  const [battles, setBattles] = useState<(LectorBattle & { hasVoted?: boolean; userVote?: number | null })[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({
    totalVotes: 12846,
    totalBattles: 6423,
    totalLectors: 312,
    season: 'სეზონი 01',
    university: 'BTU',
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([
    {
      id: '1',
      rank: 1,
      name: 'ნინო კაპანაძე',
      isCrown: true,
      percent: 78,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: '2',
      rank: 2,
      name: 'გიორგი მელაძე',
      isCrown: false,
      percent: 76,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: '3',
      rank: 3,
      name: 'თამარ ნელოიძე',
      isCrown: false,
      percent: 72,
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: '4',
      rank: 4,
      name: 'ალექსანდრე ბენაშვილი',
      isCrown: false,
      percent: 70,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: '5',
      rank: 5,
      name: 'ლევან ქარდავა',
      isCrown: false,
      percent: 68,
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'rating' | 'stats' | 'about'>('main');

  const { socket } = useSocket();
  const { showToast } = useToast();
  const voterId = getOrCreateVoterId();

  // 1. Fetch feed data
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
        if (data.leaderboard && data.leaderboard.length > 0) {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-white text-base sm:text-lg tracking-tight">
              Fav Lector
            </span>
          </div>

          {/* Center Navigation Pills */}
          <nav className="hidden md:flex items-center bg-[#141720]/80 border border-white/[0.08] p-1 rounded-full shadow-inner">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                activeTab === 'main'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              მთავარი
            </button>
            <button
              onClick={() => setActiveTab('rating')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                activeTab === 'rating'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              რეიტინგი
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                activeTab === 'stats'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              სტატისტიკა
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                activeTab === 'about'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              შესახებ
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-stone-200">
              <Landmark className="w-3.5 h-3.5 text-[#C8A97E]" />
              <span>BTU</span>
              <ChevronDown className="w-3 h-3 text-stone-500" />
            </div>

            <button
              onClick={handleShareLink}
              className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5"
              title="გაზიარება"
            >
              <Share2 className="w-3.5 h-3.5 text-[#C8A97E]" />
              <span className="hidden sm:inline">გაზიარება</span>
            </button>

            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-stone-300">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-8 sm:pt-12 pb-6 px-4 text-center max-w-4xl mx-auto">
        <div className="inline-block tracking-widest uppercase text-[11px] font-bold text-[#C8A97E] mb-3">
          BTU BATTLE • {stats.season}
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3">
          <LaurelLeft />
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            რომელია შენი ფავორიტი ლექტორი?
          </h1>
          <LaurelRight />
        </div>

        <p className="text-stone-400 text-xs sm:text-sm md:text-base max-w-lg mx-auto font-normal mb-8">
          აირჩიე ერთ-ერთი ლექტორი და გააგრძელე წყვილები.
        </p>

        {/* 4 STATS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2.5 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Users className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white">
                {stats.totalVotes.toLocaleString()}
              </div>
              <div className="text-[10px] text-stone-500 font-medium">სულ ხმები</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Swords className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white">
                {stats.totalBattles.toLocaleString()}
              </div>
              <div className="text-[10px] text-stone-500 font-medium">ბრძოლა</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <GraduationCap className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white">
                {stats.totalLectors}
              </div>
              <div className="text-[10px] text-stone-500 font-medium">ლექტორი</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5 px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Landmark className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-white">
                {stats.season}
              </div>
              <div className="text-[10px] text-stone-500 font-medium">{stats.university}</div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN TWO-COLUMN CONTAINER */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* LEFT: VERSUS ARENA */}
          <div className="w-full lg:flex-1 space-y-6">
            {/* Cards Container with Center VS Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 relative">
              {/* Center VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#D8BE93] text-stone-900 font-black italic shadow-2xl flex items-center justify-center tracking-wider text-xs sm:text-sm pointer-events-none ring-4 ring-[#0B0D12]">
                VS
              </div>

              {/* LECTURER 1 CARD */}
              <div className="space-y-3">
                <div
                  onClick={() => handleVote(1)}
                  className={`relative rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-[3/4] bg-[#141720] border transition-all duration-300 shadow-2xl group cursor-pointer ${
                    currentBattle?.userVote === 1
                      ? 'border-[#D8BE93] ring-2 ring-[#D8BE93]/40'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={currentBattle?.lector1Photo}
                    alt={currentBattle?.lector1Name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

                  {/* Name & Subject Overlay */}
                  <div className="absolute bottom-5 left-5 right-5">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-md">
                      {currentBattle?.lector1Name}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-300 font-medium mt-1">
                      {currentBattle?.lector1Subject}
                    </p>
                  </div>

                  {currentBattle?.userVote === 1 && (
                    <div className="absolute top-4 right-4 bg-[#D8BE93] text-stone-950 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>შენი არჩევანი</span>
                    </div>
                  )}
                </div>

                {/* Vote Button 1 */}
                <button
                  onClick={() => handleVote(1)}
                  disabled={voting || currentBattle?.hasVoted}
                  className={`w-full py-3.5 px-5 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-98 shadow-md cursor-pointer ${
                    currentBattle?.userVote === 1
                      ? 'bg-[#D8BE93] text-stone-900 shadow-[#D8BE93]/20'
                      : currentBattle?.hasVoted
                      ? 'bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed'
                      : 'bg-[#151821] hover:bg-[#1E2230] border border-white/15 text-white'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      currentBattle?.userVote === 1 ? 'fill-stone-900 text-stone-900' : 'text-stone-300'
                    }`}
                  />
                  <span>
                    {currentBattle?.userVote === 1
                      ? 'არჩეულია'
                      : currentBattle?.hasVoted
                      ? 'ხმა მიცემულია'
                      : 'აირჩიე ეს ლექტორი'}
                  </span>
                </button>
              </div>

              {/* LECTURER 2 CARD */}
              <div className="space-y-3">
                <div
                  onClick={() => handleVote(2)}
                  className={`relative rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-[3/4] bg-[#141720] border transition-all duration-300 shadow-2xl group cursor-pointer ${
                    currentBattle?.userVote === 2
                      ? 'border-[#D8BE93] ring-2 ring-[#D8BE93]/40'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img
                    src={currentBattle?.lector2Photo}
                    alt={currentBattle?.lector2Name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

                  {/* Name & Subject Overlay */}
                  <div className="absolute bottom-5 left-5 right-5">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-md">
                      {currentBattle?.lector2Name}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-300 font-medium mt-1">
                      {currentBattle?.lector2Subject}
                    </p>
                  </div>

                  {currentBattle?.userVote === 2 && (
                    <div className="absolute top-4 right-4 bg-[#D8BE93] text-stone-950 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>შენი არჩევანი</span>
                    </div>
                  )}
                </div>

                {/* Vote Button 2 */}
                <button
                  onClick={() => handleVote(2)}
                  disabled={voting || currentBattle?.hasVoted}
                  className={`w-full py-3.5 px-5 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-98 shadow-md cursor-pointer ${
                    currentBattle?.userVote === 2
                      ? 'bg-[#D8BE93] text-stone-900 shadow-[#D8BE93]/20'
                      : currentBattle?.hasVoted
                      ? 'bg-white/5 border border-white/10 text-stone-500 cursor-not-allowed'
                      : 'bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-900 shadow-[#D8BE93]/20'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      currentBattle?.userVote === 2 ? 'fill-stone-900 text-stone-900' : 'fill-stone-900'
                    }`}
                  />
                  <span>
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
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleRandomPair}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-stone-300 transition flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#C8A97E]" />
                <span>შემთხვევითი წყვილი</span>
              </button>

              <div className="text-xs font-bold text-stone-400">
                {currentIndex + 1} / {Math.max(battles.length, 10)}
              </div>

              <button
                onClick={handleNextPair}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-stone-300 transition flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <span>შემდეგი წყვილი</span>
                <span>→</span>
              </button>
            </div>
          </div>

          {/* RIGHT: LEADERBOARD SIDEBAR */}
          <aside className="w-full lg:w-[350px] xl:w-[380px] bg-[#13161F]/90 border border-white/[0.08] rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D8BE93]">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  ტოპ ლექტორები
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  ყველაზე ხშირად არჩეულები
                </p>
              </div>
            </div>

            {/* Ranked List */}
            <div className="space-y-4">
              {leaderboard.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-white/[0.03] transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Circle */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
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
                    <img
                      src={item.avatar}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                    />

                    {/* Name */}
                    <div className="truncate">
                      <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">{item.name}</span>
                        {item.isCrown && (
                          <Crown className="w-3.5 h-3.5 text-[#D8BE93] fill-[#D8BE93] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Percentage */}
                  <div className="text-xs sm:text-sm font-bold text-stone-300 flex-shrink-0">
                    {item.percent}%
                  </div>
                </div>
              ))}
            </div>

            {/* Full Rating Link */}
            <button
              onClick={() => showToast('სრული რეიტინგი ხელმისაწვდომი იქნება სეზონის ბოლოს!', 'info')}
              className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
            >
              <span>სრული რეიტინგი</span>
              <span>→</span>
            </button>
          </aside>
        </div>

        {/* BOTTOM PROGRESS BAR */}
        {currentBattle && (
          <div className="mt-8 bg-[#13161F]/90 border border-white/[0.08] rounded-2xl sm:rounded-full p-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-300 flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-[#D8BE93]" />
              <span>ბრძოლის პროგრესი</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 sm:max-w-xl mx-auto">
              <div className="text-xs font-bold text-[#D8BE93] whitespace-nowrap">
                {currentBattle.lector1Percent}%
                <span className="hidden md:inline ml-1 text-stone-400 font-normal">
                  {currentBattle.lector1Name}
                </span>
              </div>

              {/* Dual Color Progress Bar */}
              <div className="flex-1 h-2.5 sm:h-3 bg-[#242A38] rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[#D8BE93] transition-all duration-700 ease-out"
                  style={{ width: `${currentBattle.lector1Percent}%` }}
                />
                <div
                  className="h-full bg-[#353D50] transition-all duration-700 ease-out"
                  style={{ width: `${currentBattle.lector2Percent}%` }}
                />
              </div>

              <div className="text-xs font-bold text-stone-300 whitespace-nowrap">
                <span className="hidden md:inline mr-1 text-stone-400 font-normal">
                  {currentBattle.lector2Name}
                </span>
                {currentBattle.lector2Percent}%
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
}
export default LectorBattlePage;

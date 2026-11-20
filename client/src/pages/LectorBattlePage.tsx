import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  Crown,
  Flame,
  HelpCircle,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import type { BattleActiveResponse, LectorBattle } from '../types';
import { getOrCreateVoterId } from '../utils/voterId';

export function LectorBattlePage() {
  const [battle, setBattle] = useState<LectorBattle | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<number | null>(null);

  const { socket } = useSocket();
  const { showToast } = useToast();

  const voterId = getOrCreateVoterId();

  // 1. Fetch active battle
  useEffect(() => {
    async function loadBattle() {
      try {
        setLoading(true);
        const data = await apiRequest<BattleActiveResponse>(`/battles/active?voterId=${voterId}`);
        if (data.battle) {
          setBattle(data.battle);
          setHasVoted(data.hasVoted);
          setUserVote(data.userVote);
        }
      } catch (err: any) {
        showToast(err.message || 'ბრძოლის ჩატვირთვა ვერ მოხერხდა', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadBattle();
  }, [voterId]);

  // 2. Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleBattleUpdate = (updatedBattle: LectorBattle) => {
      if (battle && battle.id === updatedBattle.id) {
        setBattle(updatedBattle);
      } else if (!battle) {
        setBattle(updatedBattle);
      }
    };

    socket.on('battle:update', handleBattleUpdate);

    if (battle?.id) {
      socket.on(`battle:${battle.id}`, handleBattleUpdate);
    }

    return () => {
      socket.off('battle:update', handleBattleUpdate);
      if (battle?.id) {
        socket.off(`battle:${battle.id}`, handleBattleUpdate);
      }
    };
  }, [socket, battle?.id]);

  // 3. Handle Voting
  async function handleVote(lectorNumber: 1 | 2) {
    if (!battle || voting || hasVoted) return;

    try {
      setVoting(true);
      const res = await apiRequest<{
        success: boolean;
        battle: LectorBattle;
        hasVoted: boolean;
        userVote: number;
      }>(`/battles/${battle.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          selectedLector: lectorNumber,
          voterId,
        }),
      });

      setBattle(res.battle);
      setHasVoted(true);
      setUserVote(lectorNumber);

      // Dopamine explosion!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: lectorNumber === 1 ? ['#6366F1', '#818CF8', '#A5B4FC'] : ['#EC4899', '#F472B6', '#FB7185'],
      });

      showToast('შენი ხმა წარმატებით დაფიქსირდა! 🔥', 'success');
    } catch (err: any) {
      showToast(err.message || 'ხმის მიცემა ვერ მოხერხდა', 'error');
    } finally {
      setVoting(false);
    }
  }

  // 4. Share link
  function handleShareLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('ლინკი დაკოპირდა! გაუგზავნე მეგობრებს 🚀', 'success');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center animate-pulse">
          <Flame className="w-8 h-8 text-indigo-400 animate-bounce" />
        </div>
        <p className="mt-4 text-slate-400 font-medium text-sm">Fav Lector იტვირთება...</p>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4">
          <Flame className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white">ახალი ბრძოლა მალე დაიწყება!</h2>
        <p className="text-slate-400 text-sm mt-2 max-w-sm">
          შემდეგი კვირის დაპირისპირება მზადების პროცესშია. შემოიხედე მოგვიანებით!
        </p>
      </div>
    );
  }

  const isLector1Leader = battle.lector1Votes > battle.lector2Votes;
  const isLector2Leader = battle.lector2Votes > battle.lector1Votes;

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* Background Neon Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 sm:w-96 h-80 sm:h-96 bg-indigo-600/15 rounded-full blur-[100px] sm:blur-[128px]" />
        <div className="absolute top-1/2 -right-32 w-80 sm:w-96 h-80 sm:h-96 bg-pink-600/15 rounded-full blur-[100px] sm:blur-[128px]" />
        <div className="absolute -bottom-32 left-1/3 w-80 sm:w-96 h-80 sm:h-96 bg-cyan-600/10 rounded-full blur-[100px] sm:blur-[128px]" />
      </div>

      {/* Top Sticky Navbar - Always on top with z-50 */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/90 bg-[#070B14]/95 backdrop-blur-md shadow-lg shadow-black/30">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-tight text-white text-sm sm:text-base">Fav Lector</span>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  BTU
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 leading-none">სტუდენტური ხმის მიცემა</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareLink}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              title="ლინკის გაზიარება"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
              <span>გაზიარება</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Battle Container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-8 flex flex-col justify-center">
        {/* Headline Section */}
        <div className="text-center space-y-2 mb-6 sm:mb-8 px-1">
          <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] sm:text-xs font-semibold text-slate-300 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-bold">LIVE BATTLE</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              {battle.totalVotes} სტუდენტის ხმა
            </span>
          </div>

          <h1 className="text-xl sm:text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm leading-tight break-words">
            {battle.title}
          </h1>

          <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-lg mx-auto font-medium">
            {battle.description || 'მიეცი ხმა შენს ფავორიტ ლექტორს! არჩევანი ანონიმურია და საბოლოო.'}
          </p>
        </div>

        {/* Dual Progress Bar (Always visible or highlighted after vote) */}
        <div className="max-w-2xl mx-auto w-full mb-8">
          <div className="flex justify-between items-end text-xs font-bold mb-2">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <span className="text-sm sm:text-base">{battle.lector1Percent}%</span>
              <span className="text-slate-400 font-medium truncate max-w-[120px] sm:max-w-none">
                {battle.lector1Name}
              </span>
            </div>
            <div className="text-slate-500 font-medium text-[11px]">
              სულ {battle.totalVotes} ხმა
            </div>
            <div className="flex items-center gap-1.5 text-pink-400">
              <span className="text-slate-400 font-medium truncate max-w-[120px] sm:max-w-none">
                {battle.lector2Name}
              </span>
              <span className="text-sm sm:text-base">{battle.lector2Percent}%</span>
            </div>
          </div>

          <div className="h-3 sm:h-4 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 flex shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-l-full transition-all duration-700 ease-out"
              style={{ width: `${battle.lector1Percent}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-r-full transition-all duration-700 ease-out"
              style={{ width: `${battle.lector2Percent}%` }}
            />
          </div>
        </div>

        {/* Versus Battle Arena (Two Head-to-Head Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-8 items-stretch relative">
          {/* Middle VS Badge for Desktop */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-slate-900 border-2 border-slate-700/80 shadow-2xl shadow-black items-center justify-center font-black text-white text-sm lg:text-base tracking-widest pointer-events-none">
            <span className="bg-gradient-to-tr from-rose-400 to-indigo-400 bg-clip-text text-transparent">
              VS
            </span>
          </div>

          {/* LECTURER 1 CARD */}
          <div
            className={`group relative rounded-2xl sm:rounded-3xl bg-slate-900/80 border p-4 sm:p-5 md:p-6 flex flex-col justify-between transition-all duration-300 shadow-xl backdrop-blur-md overflow-hidden ${
              userVote === 1
                ? 'border-indigo-500 ring-2 sm:ring-4 ring-indigo-500/20 bg-indigo-950/20'
                : 'border-slate-800 hover:border-indigo-500/50'
            }`}
          >
            {/* Top Badge */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-[11px] sm:text-xs font-extrabold uppercase px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                ვარიანტი A
              </span>
              {isLector1Leader && battle.totalVotes > 0 && (
                <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  ლიდერი
                </span>
              )}
            </div>

            {/* Lecturer 1 Photo (Guaranteed Aspect Ratio, No Distortion) */}
            <div className="relative w-full aspect-[4/5] sm:aspect-square max-h-[300px] sm:max-h-[360px] md:max-h-[380px] rounded-xl sm:rounded-2xl overflow-hidden mb-3.5 sm:mb-4 bg-slate-950 border border-slate-800 shadow-inner group-hover:scale-[1.01] transition-transform duration-300">
              <img
                src={battle.lector1Photo}
                alt={battle.lector1Name}
                className="w-full h-full object-cover object-center"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

              {/* Overlay Name & Subject */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-white leading-tight drop-shadow-md">
                  {battle.lector1Name}
                </h3>
                <p className="text-[11px] sm:text-xs md:text-sm font-semibold text-indigo-300 drop-shadow-sm">
                  {battle.lector1Subject}
                </p>
              </div>

              {/* Checkmark if voted */}
              {userVote === 1 && (
                <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-indigo-600 text-white p-1 sm:p-1.5 rounded-full shadow-lg flex items-center gap-1 px-2 sm:px-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-[11px] font-bold">შენი არჩევანი</span>
                </div>
              )}
            </div>

            {/* Stats & Vote Button */}
            <div className="space-y-2.5 sm:space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] sm:text-xs text-slate-400 font-medium">
                  ხმების რაოდენობა:
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    {battle.lector1Votes} ხმა
                  </span>
                  <span className="text-sm sm:text-base font-black text-indigo-400">
                    {battle.lector1Percent}%
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleVote(1)}
                disabled={voting || hasVoted}
                className={`w-full py-3 sm:py-3.5 px-4 sm:px-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-98 shadow-lg ${
                  userVote === 1
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                    : hasVoted
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-600/30 hover:shadow-indigo-500/40 cursor-pointer'
                }`}
              >
                {userVote === 1 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>მიცემული გაქვს ხმა</span>
                  </>
                ) : hasVoted ? (
                  <span>ხმა უკვე დაფიქსირებულია</span>
                ) : (
                  <>
                    <Flame className="w-4 h-4 text-indigo-200" />
                    <span>ხმის მიცემა ({battle.lector1Name.split(' ')[0]})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Middle VS Badge for Mobile */}
          <div className="flex md:hidden items-center justify-center -my-3 z-10">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 shadow-xl flex items-center justify-center font-black text-xs tracking-widest">
              <span className="bg-gradient-to-tr from-rose-400 to-indigo-400 bg-clip-text text-transparent">
                VS
              </span>
            </div>
          </div>

          {/* LECTURER 2 CARD */}
          <div
            className={`group relative rounded-2xl sm:rounded-3xl bg-slate-900/80 border p-4 sm:p-5 md:p-6 flex flex-col justify-between transition-all duration-300 shadow-xl backdrop-blur-md overflow-hidden ${
              userVote === 2
                ? 'border-pink-500 ring-2 sm:ring-4 ring-pink-500/20 bg-pink-950/20'
                : 'border-slate-800 hover:border-pink-500/50'
            }`}
          >
            {/* Top Badge */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-[11px] sm:text-xs font-extrabold uppercase px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                ვარიანტი B
              </span>
              {isLector2Leader && battle.totalVotes > 0 && (
                <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  ლიდერი
                </span>
              )}
            </div>

            {/* Lecturer 2 Photo (Guaranteed Aspect Ratio, No Distortion) */}
            <div className="relative w-full aspect-[4/5] sm:aspect-square max-h-[300px] sm:max-h-[360px] md:max-h-[380px] rounded-xl sm:rounded-2xl overflow-hidden mb-3.5 sm:mb-4 bg-slate-950 border border-slate-800 shadow-inner group-hover:scale-[1.01] transition-transform duration-300">
              <img
                src={battle.lector2Photo}
                alt={battle.lector2Name}
                className="w-full h-full object-cover object-center"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

              {/* Overlay Name & Subject */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-white leading-tight drop-shadow-md">
                  {battle.lector2Name}
                </h3>
                <p className="text-[11px] sm:text-xs md:text-sm font-semibold text-pink-300 drop-shadow-sm">
                  {battle.lector2Subject}
                </p>
              </div>

              {/* Checkmark if voted */}
              {userVote === 2 && (
                <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-pink-600 text-white p-1 sm:p-1.5 rounded-full shadow-lg flex items-center gap-1 px-2 sm:px-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-[11px] font-bold">შენი არჩევანი</span>
                </div>
              )}
            </div>

            {/* Stats & Vote Button */}
            <div className="space-y-2.5 sm:space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] sm:text-xs text-slate-400 font-medium">
                  ხმების რაოდენობა:
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    {battle.lector2Votes} ხმა
                  </span>
                  <span className="text-sm sm:text-base font-black text-pink-400">
                    {battle.lector2Percent}%
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleVote(2)}
                disabled={voting || hasVoted}
                className={`w-full py-3 sm:py-3.5 px-4 sm:px-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-98 shadow-lg ${
                  userVote === 2
                    ? 'bg-pink-600 text-white shadow-pink-600/30'
                    : hasVoted
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white shadow-pink-600/30 hover:shadow-pink-500/40 cursor-pointer'
                }`}
              >
                {userVote === 2 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>მიცემული გაქვს ხმა</span>
                  </>
                ) : hasVoted ? (
                  <span>ხმა უკვე დაფიქსირებულია</span>
                ) : (
                  <>
                    <Flame className="w-4 h-4 text-pink-200" />
                    <span>ხმის მიცემა ({battle.lector2Name.split(' ')[0]})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Realtime Note */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-slate-400 text-center">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              ხმები განახლდება რეალურ დროში. გვერდის გადატვირთვა არაა საჭირო.
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 backdrop-blur-md py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Fav Lector • BTU სტუდენტური პლატფორმა</p>
          <p className="text-slate-500 text-[11px]">
            ყველა ხმა ანონიმურია და დაცულია
          </p>
        </div>
      </footer>
    </div>
  );
}
export default LectorBattlePage;

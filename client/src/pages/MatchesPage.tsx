import { useEffect, useState } from 'react';
import { ArrowLeftRight, Send, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { AppLayout } from '../components/layout/AppLayout';
import { useToast } from '../context/ToastContext';
import type { SmartMatch } from '../types';

export function MatchesPage() {
  const { showToast } = useToast();
  const [matches, setMatches] = useState<SmartMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ matches: SmartMatch[] }>('/listings/matches');
      setMatches(data.matches);
    } catch {
      showToast('დამთხვევების ჩატვირთვა ვერ მოხერხდა', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const quickSendOffer = async (match: SmartMatch) => {
    setSendingId(match.matchedListing.id);
    try {
      await apiRequest('/offers', {
        method: 'POST',
        body: JSON.stringify({
          listingId: match.matchedListing.id,
          offeredGroupCode: match.myListing.currentGroupCode,
          offeredLecturerName: match.myListing.currentLecturerName,
          offeredDay: match.myListing.currentDay,
          offeredTime: match.myListing.currentTime,
          message: `გამარჯობა! Smart Matching-მა დაგვაკავშირა: მაქვს ${match.myListing.currentGroupCode} (${match.myListing.currentDay} ${match.myListing.currentTime}) და მსურს გაცვლა.`,
        }),
      });
      showToast('შეთავაზება გაგზავნილია!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეცდომა', 'error');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Smart Matching — ავტომატური დამთხვევები
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            სისტემა აანალიზებს თქვენს აქტიურ განცხადებებს და პოულობს სტუდენტებს ორმხრივად
            შესაბამისი მოთხოვნით
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            მიმდინარეობს დამთხვევების ძებნა...
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
            <p className="font-bold text-slate-900">ამ ეტაპზე ორმხრივი დამთხვევა ვერ მოიძებნა</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              დაამატეთ განცხადება თქვენს სასურველ დროზე და როგორც კი შესაბამისი სტუდენტი გამოჩნდება,
              შეტყობინებას მიიღებთ.
            </p>
            <Link
              to="/listings/new"
              className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold"
            >
              განცხადების დამატება
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => (
              <div
                key={`${m.myListing.id}-${m.matchedListing.id}`}
                className="bg-white rounded-2xl border border-indigo-200/80 p-5 shadow-card space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      firstName={m.matchedListing.author.firstName}
                      lastName={m.matchedListing.author.lastName}
                      avatarUrl={m.matchedListing.author.avatarUrl}
                      verificationStatus={m.matchedListing.author.studentVerificationStatus}
                    />
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {m.matchedListing.author.firstName} {m.matchedListing.author.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.matchedListing.courseCode} · {m.matchedListing.courseName}
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold">
                    {m.matchScore}% დამთხვევა
                  </span>
                </div>

                <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                    <p className="font-bold text-slate-500 uppercase text-[10px]">თქვენ გთავაზობთ</p>
                    <p className="font-bold text-slate-900 mt-1">
                      {m.myListing.currentGroupCode} · {m.myListing.currentDay}{' '}
                      {m.myListing.currentTime}
                    </p>
                    <p className="text-slate-600">{m.myListing.currentLecturerName}</p>
                  </div>

                  <div className="hidden md:flex justify-center">
                    <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                  </div>

                  <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 p-3.5">
                    <p className="font-bold text-indigo-600 uppercase text-[10px]">
                      პარტნიორს აქვს
                    </p>
                    <p className="font-bold text-indigo-900 mt-1">
                      {m.matchedListing.currentGroupCode} · {m.matchedListing.currentDay}{' '}
                      {m.matchedListing.currentTime}
                    </p>
                    <p className="text-slate-700">{m.matchedListing.currentLecturerName}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap gap-1.5">
                    {m.matchReasons.map((r) => (
                      <span
                        key={r}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700"
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  <button
                    disabled={sendingId === m.matchedListing.id}
                    onClick={() => quickSendOffer(m)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingId === m.matchedListing.id
                      ? 'იგზავნება...'
                      : 'პირდაპირი შეთავაზების გაგზავნა'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

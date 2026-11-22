import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flag,
  Instagram,
  Mail,
  RefreshCw,
  Trash2,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { AdminStudentProfile, AdminStudentsListResponse } from '../../types';

interface AdminStudentModerationProps {
  adminPin: string;
  onCountsChange?: (counts: AdminStudentsListResponse['counts']) => void;
}

type ModerationTab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REPORTED' | 'ALL';

export function AdminStudentModeration({
  adminPin,
  onCountsChange,
}: AdminStudentModerationProps) {
  const [profiles, setProfiles] = useState<AdminStudentProfile[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, reported: 0 });
  const [activeTab, setActiveTab] = useState<ModerationTab>('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<{ photo: string; name: string } | null>(null);
  const { showToast } = useToast();

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/students/admin/list', {
        headers: { 'x-admin-pin': adminPin },
      });
      const data = (await res.json()) as AdminStudentsListResponse & { message?: string };
      if (!res.ok) throw new Error(data.message || 'მონაცემების ჩატვირთვა ვერ მოხერხდა');
      setProfiles(data.profiles || []);
      setCounts(data.counts);
      onCountsChange?.(data.counts);
    } catch (err: any) {
      showToast(err.message || 'შეცდომა ჩატვირთვისას', 'error');
    } finally {
      setLoading(false);
    }
  }, [adminPin, onCountsChange, showToast]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
    let rejectionReason: string | undefined;
    if (status === 'REJECTED') {
      const input = window.prompt('უარყოფის მიზეზი (არასავალდებულო, მაგ: უხარისხო ფოტო):');
      if (input === null) return; // cancelled
      rejectionReason = input.trim() || undefined;
    }

    try {
      setBusyId(id);
      const res = await fetch(`/api/students/admin/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({ status, rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'სტატუსის შეცვლა ვერ მოხერხდა');

      showToast(
        status === 'APPROVED'
          ? 'დადასტურდა! სტუდენტი უკვე ჩართულია ბრძოლაში ✅'
          : status === 'REJECTED'
          ? 'განაცხადი უარყოფილია'
          : 'დაბრუნდა მომლოდინეში',
        'success'
      );
      await loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'ოპერაცია ვერ შესრულდა', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function resolveReport(reportId: string) {
    try {
      setBusyId(reportId);
      const res = await fetch(`/api/students/admin/reports/${reportId}/resolve`, {
        method: 'PATCH',
        headers: { 'x-admin-pin': adminPin },
      });
      if (!res.ok) throw new Error('რეპორტის დახურვა ვერ მოხერხდა');
      showToast('რეპორტი მოგვარებულად მოინიშნა', 'success');
      await loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'შეცდომა', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProfile(id: string, name: string) {
    if (!window.confirm(`ნამდვილად გსურთ "${name}"-ის სრულად წაშლა ბაზიდან?`)) return;
    try {
      setBusyId(id);
      const res = await fetch(`/api/students/admin/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': adminPin },
      });
      if (!res.ok) throw new Error('წაშლა ვერ მოხერხდა');
      showToast('პროფილი წაიშალა', 'info');
      await loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'შეცდომა წაშლისას', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = profiles.filter((p) => {
    if (activeTab === 'PENDING') return p.status === 'PENDING';
    if (activeTab === 'APPROVED') return p.status === 'APPROVED';
    if (activeTab === 'REJECTED') return p.status === 'REJECTED';
    if (activeTab === 'REPORTED') return p.openReportsCount > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header + Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span>სტუდენტების მოდერაცია</span>
            <span className="text-sm font-normal text-slate-400">({profiles.length} სულ)</span>
          </h2>
          <p className="text-xs text-slate-400">
            დაადასტურე ან უარყავი სტუდენტების ატვირთული ფოტოები — მხოლოდ დადასტურებულები ჩანს საიტზე
          </p>
        </div>

        <button
          onClick={loadProfiles}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>განახლება</span>
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'PENDING', label: 'მომლოდინე', count: counts.pending, accent: 'amber' },
            { id: 'APPROVED', label: 'დადასტურებული', count: counts.approved, accent: 'emerald' },
            { id: 'REPORTED', label: '🚩 რეპორტები', count: counts.reported, accent: 'rose' },
            { id: 'REJECTED', label: 'უარყოფილი', count: counts.rejected, accent: 'slate' },
            { id: 'ALL', label: 'ყველა', count: profiles.length, accent: 'indigo' },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : tab.count > 0 && tab.id === 'PENDING'
                    ? 'bg-amber-500/20 text-amber-300'
                    : tab.count > 0 && tab.id === 'REPORTED'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading && profiles.length === 0 ? (
        <div className="py-16 flex justify-center">
          <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-12 text-center text-slate-400 text-sm">
          ამ კატეგორიაში განაცხადები არ არის
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const isBusy = busyId === p.id;
            const openReports = p.reports.filter((r) => r.status === 'OPEN');

            return (
              <div
                key={p.id}
                className={`rounded-2xl bg-slate-900/90 border p-4 flex flex-col gap-3.5 transition ${
                  openReports.length > 0
                    ? 'border-rose-500/60 ring-1 ring-rose-500/20'
                    : p.status === 'PENDING'
                    ? 'border-amber-500/40'
                    : p.status === 'APPROVED'
                    ? 'border-emerald-500/35'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex gap-4">
                  {/* Portrait Preview (click to zoom) */}
                  <button
                    type="button"
                    onClick={() => setZoomPhoto({ photo: p.photo, name: p.name })}
                    className="relative w-24 aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-700 flex-shrink-0 cursor-zoom-in group"
                  >
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition"
                    />
                  </button>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-base truncate">{p.name}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {p.gender === 'FEMALE' ? 'გოგო' : 'ბიჭი'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                              p.relationType === 'SELF'
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {p.relationType === 'SELF' ? (
                              <>
                                <User className="w-2.5 h-2.5" />
                                <span>საკუთარი</span>
                              </>
                            ) : (
                              <>
                                <Users className="w-2.5 h-2.5" />
                                <span>მეგობრის</span>
                              </>
                            )}
                          </span>
                          {p.status === 'PENDING' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> მომლოდინე
                            </span>
                          )}
                          {p.status === 'APPROVED' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> აქტიური
                            </span>
                          )}
                          {p.status === 'REJECTED' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" /> უარყოფილი
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Instagram & Uploader BTU Email */}
                    <div className="space-y-1 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{p.uploaderEmail}</span>
                      </div>
                      {p.instagram && (
                        <a
                          href={`https://instagram.com/${p.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-pink-300 hover:underline"
                        >
                          <Instagram className="w-3.5 h-3.5" />
                          <span>@{p.instagram}</span>
                        </a>
                      )}
                      {p.status === 'APPROVED' && (
                        <div className="text-[11px] text-slate-400 pt-0.5">
                          Elo: <strong className="text-white">{p.eloRating}</strong> • მოგება:{' '}
                          <strong className="text-emerald-400">{p.wins}</strong> • {p.winPercent}%
                        </div>
                      )}
                      {p.rejectionReason && (
                        <div className="text-[11px] text-rose-300">მიზეზი: {p.rejectionReason}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Open Reports Box */}
                {openReports.length > 0 && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 space-y-2">
                    <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" />
                      <span>აქტიური რეპორტები ({openReports.length})</span>
                    </div>
                    {openReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="flex items-start justify-between gap-2 text-xs text-rose-100 bg-black/25 rounded-lg p-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold">{rep.reason}</div>
                          {rep.details && <div className="text-[11px] text-rose-200/80 mt-0.5">{rep.details}</div>}
                        </div>
                        <button
                          onClick={() => resolveReport(rep.id)}
                          disabled={busyId === rep.id}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white flex-shrink-0 cursor-pointer"
                        >
                          დახურვა
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  {p.status !== 'APPROVED' && (
                    <button
                      onClick={() => updateStatus(p.id, 'APPROVED')}
                      disabled={isBusy}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>დადასტურება</span>
                    </button>
                  )}
                  {p.status !== 'REJECTED' && (
                    <button
                      onClick={() => updateStatus(p.id, 'REJECTED')}
                      disabled={isBusy}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/35 disabled:opacity-50 text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>უარყოფა</span>
                    </button>
                  )}
                  <button
                    onClick={() => deleteProfile(p.id, p.name)}
                    disabled={isBusy}
                    title="სრულად წაშლა"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {zoomPhoto && (
        <div
          onClick={() => setZoomPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={zoomPhoto.photo}
              alt={zoomPhoto.name}
              className="w-full rounded-3xl object-contain max-h-[82vh] border border-white/15 shadow-2xl"
            />
            <p className="text-center text-sm font-bold text-white mt-3">{zoomPhoto.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

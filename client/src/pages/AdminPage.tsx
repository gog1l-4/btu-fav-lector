import { useEffect, useState } from 'react';
import { CheckCircle, Flag, ShieldCheck, Trash2, Users } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ListingStatusBadge } from '../components/common/StatusBadge';
import { AppLayout } from '../components/layout/AppLayout';
import { useToast } from '../context/ToastContext';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  pendingVerifications: number;
  totalListings: number;
  openListings: number;
  completedSwaps: number;
  openReports: number;
}

interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  studyYear: number;
  studentVerificationStatus: string;
  studentIdNumber: string | null;
  isSuspended: boolean;
  university: { shortName: string };
  _count: { listings: number };
}

interface AdminListingRow {
  id: string;
  currentGroupCode: string;
  currentTime: string;
  desiredTime: string;
  status: 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED';
  author: { firstName: string; lastName: string; email: string };
  course: { code: string; name: string };
  _count: { offers: number; reports: number };
}

interface AdminReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED';
  reporter: { firstName: string; lastName: string };
  listing: {
    id: string;
    course: { code: string; name: string };
    author: { firstName: string; lastName: string };
  };
}

export function AdminPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'users' | 'listings' | 'reports'>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [listings, setListings] = useState<AdminListingRow[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, u, l, r] = await Promise.all([
        apiRequest<{ stats: AdminStats }>('/admin/stats'),
        apiRequest<{ users: AdminUserRow[] }>('/admin/users'),
        apiRequest<{ listings: AdminListingRow[] }>('/admin/listings'),
        apiRequest<{ reports: AdminReportRow[] }>('/admin/reports'),
      ]);
      setStats(s.stats);
      setUsers(u.users);
      setListings(l.listings);
      setReports(r.reports);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'ადმინ მონაცემები ვერ ჩაიტვირთა', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const verifyUser = async (userId: string) => {
    await apiRequest(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ studentVerificationStatus: 'VERIFIED' }),
    });
    showToast('სტუდენტი ვერიფიცირებულია', 'success');
    loadAll();
  };

  const toggleSuspend = async (userId: string, current: boolean) => {
    await apiRequest(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isSuspended: !current }),
    });
    showToast(current ? 'ანგარიში აღდგენილია' : 'ანგარიში შეჩერებულია', 'info');
    loadAll();
  };

  const deleteListing = async (listingId: string) => {
    await apiRequest(`/admin/listings/${listingId}`, { method: 'DELETE' });
    showToast('განცხადება წაიშალა', 'success');
    loadAll();
  };

  const resolveReport = async (reportId: string, status: 'REVIEWED' | 'DISMISSED') => {
    await apiRequest(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    showToast('საჩივარი დამუშავებულია', 'success');
    loadAll();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              ადმინისტრაციული პანელი
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              მომხმარებლების, განცხადებების, საჩივრებისა და სტატისტიკის მართვა
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card">
              <p className="text-2xl font-extrabold text-slate-900">{stats.totalUsers}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                მომხმარებელი ({stats.verifiedUsers} ვერიფიცირებული)
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card">
              <p className="text-2xl font-extrabold text-amber-600">
                {stats.pendingVerifications}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">ვერიფიკაციის მოლოდინში</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card">
              <p className="text-2xl font-extrabold text-indigo-600">{stats.openListings}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                აქტიური განცხადება (სულ {stats.totalListings})
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card">
              <p className="text-2xl font-extrabold text-rose-600">{stats.openReports}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                ღია საჩივარი · {stats.completedSwaps} დასრ. გაცვლა
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 shadow-card">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              tab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            მომხმარებლები ({users.length})
          </button>
          <button
            onClick={() => setTab('listings')}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${
              tab === 'listings' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            განცხადებები ({listings.length})
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              tab === 'reports' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            საჩივრები ({reports.length})
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            იტვირთება...
          </div>
        ) : tab === 'users' ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3.5">სტუდენტი</th>
                  <th className="p-3.5">ელფოსტა</th>
                  <th className="p-3.5">ID / სტატუსი</th>
                  <th className="p-3.5 text-right">მოქმედება</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-bold text-slate-900">
                      {u.firstName} {u.lastName}{' '}
                      <span className="text-slate-400 font-normal">({u.university.shortName})</span>
                    </td>
                    <td className="p-3.5 text-slate-600">{u.email}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                        {u.studentVerificationStatus}
                      </span>
                      {u.studentIdNumber && (
                        <span className="ml-2 text-slate-500">{u.studentIdNumber}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {u.studentVerificationStatus !== 'VERIFIED' && (
                        <button
                          onClick={() => verifyUser(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          დადასტურება
                        </button>
                      )}
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => toggleSuspend(u.id, u.isSuspended)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100"
                        >
                          {u.isSuspended ? 'აღდგენა' : 'შეჩერება'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'listings' ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3.5">საგანი</th>
                  <th className="p-3.5">ავტორი</th>
                  <th className="p-3.5">გაცვლა</th>
                  <th className="p-3.5">სტატუსი</th>
                  <th className="p-3.5 text-right">წაშლა</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-bold text-slate-900">
                      {l.course.code} · {l.course.name}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {l.author.firstName} {l.author.lastName}
                    </td>
                    <td className="p-3.5 text-slate-700">
                      {l.currentGroupCode} ({l.currentTime}) → {l.desiredTime}
                    </td>
                    <td className="p-3.5">
                      <ListingStatusBadge status={l.status} />
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => deleteListing(l.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        წაშლა
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                საჩივრები არ არის
              </div>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{r.reason}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100">
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      განცხადება: {r.listing.course.name} ({r.listing.author.firstName}{' '}
                      {r.listing.author.lastName}) · დაარეპორტა: {r.reporter.firstName}{' '}
                      {r.reporter.lastName}
                    </p>
                    {r.details && <p className="text-xs text-slate-500">{r.details}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {r.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => resolveReport(r.id, 'DISMISSED')}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
                        >
                          უგულებელყოფა
                        </button>
                        <button
                          onClick={() => resolveReport(r.id, 'REVIEWED')}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                        >
                          განხილულია
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteListing(r.listing.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold"
                    >
                      განცხადების წაშლა
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

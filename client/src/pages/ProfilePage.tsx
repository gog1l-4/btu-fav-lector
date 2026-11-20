import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Edit3,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { ListingStatusBadge } from '../components/common/StatusBadge';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Faculty, SwapListing, University, User } from '../types';

export function ProfilePage() {
  const { id } = useParams<{ id?: string }>();
  const { user: authUser, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const targetId = id || 'me';
  const isOwnProfile = targetId === 'me' || targetId === authUser?.id;

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [listings, setListings] = useState<SwapListing[]>([]);
  const [stats, setStats] = useState({
    publishedListingsCount: 0,
    activeOffersCount: 0,
    completedSwapsCount: 0,
  });
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [studyYear, setStudyYear] = useState(1);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [verificationNote, setVerificationNote] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        user: User;
        listings: SwapListing[];
        stats: typeof stats;
      }>(`/users/${targetId}/profile`);
      setProfileUser(data.user);
      setListings(data.listings);
      setStats(data.stats);

      setFirstName(data.user.firstName);
      setLastName(data.user.lastName);
      setFacultyId(data.user.facultyId || '');
      setStudyYear(data.user.studyYear);
      setBio(data.user.bio || '');
      setStudentIdNumber(data.user.studentIdNumber || '');

      const uniData = await apiRequest<{ universities: University[] }>('/catalog/universities');
      const uni = uniData.universities.find((u) => u.id === data.user.universityId);
      setFaculties(uni?.faculties || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'პროფილი ვერ ჩაიტვირთა', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [targetId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName,
          lastName,
          facultyId: facultyId || null,
          studyYear,
          bio,
        }),
      });
      await Promise.all([loadProfile(), refreshMe()]);
      setEditing(false);
      showToast('პროფილი განახლდა', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შენახვა ვერ მოხერხდა', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      const res = await apiRequest<{ message: string; devVerifyUrl?: string }>(
        '/auth/resend-verification',
        { method: 'POST' }
      );
      if (res.devVerifyUrl) setDevVerifyUrl(res.devVerifyUrl);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეცდომა', 'error');
    }
  };

  const handleStudentVerificationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/auth/request-student-verification', {
        method: 'POST',
        body: JSON.stringify({ studentIdNumber, verificationNote }),
      });
      showToast(res.message, 'success');
      await Promise.all([loadProfile(), refreshMe()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეცდომა', 'error');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          იტვირთება პროფილი...
        </div>
      </AppLayout>
    );
  }

  if (!profileUser) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                firstName={profileUser.firstName}
                lastName={profileUser.lastName}
                avatarUrl={profileUser.avatarUrl}
                verificationStatus={profileUser.studentVerificationStatus}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {profileUser.firstName} {profileUser.lastName}
                  </h1>
                  {profileUser.studentVerificationStatus === 'VERIFIED' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      ვერიფიცირებული სტუდენტი
                    </span>
                  ) : profileUser.studentVerificationStatus === 'PENDING_REVIEW' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      განხილვის პროცესში
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      არავერიფიცირებული
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-600 mt-1">
                  {profileUser.university.name}
                  {profileUser.faculty?.name ? ` · ${profileUser.faculty.name}` : ''} ·{' '}
                  {profileUser.studyYear} კურსი
                </p>
                {profileUser.bio && (
                  <p className="text-sm text-slate-500 mt-2 max-w-2xl">{profileUser.bio}</p>
                )}
              </div>
            </div>

            {isOwnProfile && (
              <div className="flex items-center gap-2 self-start">
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {editing ? 'დახურვა' : 'პროფილის რედაქტირება'}
                </button>
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  ანგარიშის შეცვლა
                </button>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100">
            <div className="rounded-xl bg-slate-50 p-3.5 text-center">
              <p className="text-xl font-extrabold text-slate-900">
                {stats.publishedListingsCount}
              </p>
              <p className="text-xs text-slate-500 font-medium">განცხადება</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 text-center">
              <p className="text-xl font-extrabold text-indigo-600">{stats.activeOffersCount}</p>
              <p className="text-xs text-slate-500 font-medium">აქტიური შეთავაზება</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 text-center">
              <p className="text-xl font-extrabold text-emerald-600">
                {stats.completedSwapsCount}
              </p>
              <p className="text-xs text-slate-500 font-medium">დასრულებული გაცვლა</p>
            </div>
          </div>

          {/* Edit Form */}
          {editing && isOwnProfile && (
            <form
              onSubmit={handleSaveProfile}
              className="mt-6 pt-6 border-t border-slate-100 space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">სახელი</label>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">გვარი</label>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ფაკულტეტი
                  </label>
                  <select
                    value={facultyId}
                    onChange={(e) => setFacultyId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  >
                    <option value="">აირჩიეთ ფაკულტეტი</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">კურსი</label>
                  <select
                    value={studyYear}
                    onChange={(e) => setStudyYear(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <option key={y} value={y}>
                        {y} კურსი
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  მოკლე ბიო / კომენტარი
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  {saving ? 'ინახება...' : 'ცვლილებების შენახვა'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Verification Box (for own unverified account) */}
        {isOwnProfile &&
          (!profileUser.isEmailVerified ||
            profileUser.studentVerificationStatus !== 'VERIFIED') && (
            <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-card space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h2 className="font-bold text-sm text-slate-900">
                    ანგარიშის და სტუდენტის სტატუსის ვერიფიკაცია
                  </h2>
                  <p className="text-xs text-slate-600">
                    ვერიფიცირებული ბეჯი ზრდის ნდობას სხვა სტუდენტების მხრიდან გაცვლისას.
                  </p>
                </div>
              </div>

              {!profileUser.isEmailVerified && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <MailCheck className="w-4 h-4 text-indigo-600" />
                    <span>ელფოსტა ({profileUser.email}) ჯერ არ არის დადასტურებული</span>
                  </div>
                  <button
                    onClick={handleResendEmail}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    ბმულის თავიდან გაგზავნა
                  </button>
                </div>
              )}

              {devVerifyUrl && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs break-all">
                  <span className="font-bold text-indigo-900">Dev ვერიფიკაციის ბმული: </span>
                  <a href={devVerifyUrl} className="text-indigo-700 underline">
                    {devVerifyUrl}
                  </a>
                </div>
              )}

              {profileUser.studentVerificationStatus !== 'VERIFIED' && (
                <form
                  onSubmit={handleStudentVerificationRequest}
                  className="grid sm:grid-cols-3 gap-3 items-end pt-2"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      სტუდენტური ID / ბარათის ნომერი
                    </label>
                    <input
                      required
                      value={studentIdNumber}
                      onChange={(e) => setStudentIdNumber(e.target.value)}
                      placeholder="BTU-2024-XXXX"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      შენიშვნა (არასავალდებულო)
                    </label>
                    <input
                      value={verificationNote}
                      onChange={(e) => setVerificationNote(e.target.value)}
                      placeholder="კომენტარი ადმინისთვის..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    ვერიფიკაციაზე გაგზავნა
                  </button>
                </form>
              )}
            </div>
          )}

        {/* User's Published Listings */}
        <div className="space-y-3">
          <h2 className="font-bold text-base text-slate-900">გამოქვეყნებული განცხადებები</h2>
          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-sm text-slate-500">
              გამოქვეყნებული განცხადებები ჯერ არ არის
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {listings.map((l) => (
                <div
                  key={l.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
                      {l.course.code}
                    </span>
                    <ListingStatusBadge status={l.status} />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900">{l.course.name}</h3>
                  <p className="text-xs text-slate-600">
                    მაქვს: <strong>{l.currentGroupCode}</strong> ({l.currentDay} {l.currentTime}) ·{' '}
                    {l.currentLecturerName}
                  </p>
                  <p className="text-xs text-indigo-700">
                    მინდა: <strong>{l.desiredTime}</strong>{' '}
                    {l.desiredDay ? `(${l.desiredDay})` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

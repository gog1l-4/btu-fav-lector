import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { AcademicGroup, Course, Lecturer } from '../types';

const DAYS = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];

export function CreateListingPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [groups, setGroups] = useState<AcademicGroup[]>([]);

  const [courseId, setCourseId] = useState('');
  const [currentGroupId, setCurrentGroupId] = useState('');
  const [currentLecturerName, setCurrentLecturerName] = useState('');
  const [currentGroupCode, setCurrentGroupCode] = useState('');
  const [currentDay, setCurrentDay] = useState('ორშაბათი');
  const [currentTime, setCurrentTime] = useState('16:00');

  const [desiredLecturerName, setDesiredLecturerName] = useState('');
  const [desiredGroupCode, setDesiredGroupCode] = useState('');
  const [desiredDay, setDesiredDay] = useState('');
  const [desiredTime, setDesiredTime] = useState('12:00');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.universityId) return;
    apiRequest<{ courses: Course[]; lecturers: Lecturer[]; groups: AcademicGroup[] }>(
      `/catalog/university/${user.universityId}/academic`
    )
      .then((data) => {
        setCourses(data.courses);
        setLecturers(data.lecturers);
        setGroups(data.groups);
        if (data.courses[0]) {
          setCourseId(data.courses[0].id);
        }
      })
      .catch(() => {});
  }, [user?.universityId]);

  const courseGroups = groups.filter((g) => g.courseId === courseId);

  const handleSelectCurrentGroup = (groupId: string) => {
    setCurrentGroupId(groupId);
    const g = groups.find((item) => item.id === groupId);
    if (g) {
      setCurrentGroupCode(g.groupCode);
      setCurrentLecturerName(g.lecturer?.fullName || '');
      setCurrentDay(g.dayOfWeek);
      setCurrentTime(g.startTime);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/listings', {
        method: 'POST',
        body: JSON.stringify({
          courseId,
          currentGroupId: currentGroupId || null,
          currentLecturerName,
          currentGroupCode,
          currentDay,
          currentTime,
          desiredLecturerName: desiredLecturerName || null,
          desiredGroupCode: desiredGroupCode || null,
          desiredDay: desiredDay || null,
          desiredTime,
          comment: comment || null,
        }),
      });
      showToast('განცხადება წარმატებით გამოქვეყნდა!', 'success');
      navigate('/feed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეცდომა გამოქვეყნებისას', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/feed"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              გაცვლის განცხადების დამატება
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              შეავსეთ სტრუქტურირებული ფორმა, რათა სხვა სტუდენტებმა მარტივად გიპოვონ
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Course Selector */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card space-y-4">
            <label className="block text-sm font-bold text-slate-900">1. აირჩიეთ საგანი *</label>
            <select
              required
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setCurrentGroupId('');
              }}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">აირჩიეთ საგანი...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* What I Offer */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900">2. რას ვთავაზობ (მიმდინარე)</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  მაქვს
                </span>
              </div>

              {courseGroups.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    სწრაფი არჩევა კატალოგიდან
                  </label>
                  <select
                    value={currentGroupId}
                    onChange={(e) => handleSelectCurrentGroup(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">არჩევა არსებული ჯგუფებიდან...</option>
                    {courseGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.groupCode} · {g.dayOfWeek} {g.startTime} · {g.lecturer?.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ლექტორი *</label>
                <input
                  required
                  list="current-lecturers"
                  value={currentLecturerName}
                  onChange={(e) => setCurrentLecturerName(e.target.value)}
                  placeholder="მაგ: რევაზ მაკალათია"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="current-lecturers">
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.fullName} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ჯგუფი *</label>
                <input
                  required
                  value={currentGroupCode}
                  onChange={(e) => setCurrentGroupCode(e.target.value)}
                  placeholder="მაგ: FE-02"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">დღე *</label>
                  <select
                    value={currentDay}
                    onChange={(e) => setCurrentDay(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">დრო *</label>
                  <input
                    required
                    value={currentTime}
                    onChange={(e) => setCurrentTime(e.target.value)}
                    placeholder="16:00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* What I Want */}
            <div className="bg-white rounded-2xl border border-indigo-200/80 p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-indigo-900">
                  3. რა მინდა სანაცვლოდ (სასურველი)
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  ვეძებ
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  სასურველი ლექტორი (არასავალდებულო)
                </label>
                <input
                  list="desired-lecturers"
                  value={desiredLecturerName}
                  onChange={(e) => setDesiredLecturerName(e.target.value)}
                  placeholder="ნებისმიერი ლექტორი"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="desired-lecturers">
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.fullName} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  სასურველი ჯგუფი (არასავალდებულო)
                </label>
                <input
                  value={desiredGroupCode}
                  onChange={(e) => setDesiredGroupCode(e.target.value)}
                  placeholder="მაგ: FE-01 (ან დატოვე ცარიელი)"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    სასურველი დღე
                  </label>
                  <select
                    value={desiredDay}
                    onChange={(e) => setDesiredDay(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">ნებისმიერი</option>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    სასურველი დრო *
                  </label>
                  <input
                    required
                    value={desiredTime}
                    onChange={(e) => setDesiredTime(e.target.value)}
                    placeholder="12:00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Comment & Submit */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1.5">
                კომენტარი ან განმარტება
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="მაგ: სამსახურის გამო 16:00 საათზე ვერ ვახერხებ დასწრებას, სასწრაფოდ მჭირდება 12:00..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Link
                to="/feed"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                გაუქმება
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold shadow-sm transition"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {submitting ? 'ქვეყნდება...' : 'განცხადების გამოქვეყნება'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

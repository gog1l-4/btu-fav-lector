import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { ListingCard } from '../components/feed/ListingCard';
import { ListingDetailsModal } from '../components/feed/ListingDetailsModal';
import { ProposeOfferModal } from '../components/feed/ProposeOfferModal';
import { ReportModal } from '../components/feed/ReportModal';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Course, Lecturer, SmartMatch, SwapListing, University } from '../types';

const CATEGORY_PILLS = [
  { id: 'all', label: 'ყველაფერი', query: '' },
  { id: 'frontend', label: 'Front-end', query: 'Front-end' },
  { id: 'backend', label: 'Back-end', query: 'Back-end' },
  { id: 'databases', label: 'მონაცემთა ბაზები', query: 'მონაცემთა ბაზების' },
  { id: 'algorithms', label: 'ალგორითმები', query: 'ალგორითმები' },
  { id: 'marketing', label: 'მარკეტინგი', query: 'მარკეტინგ' },
  { id: 'business', label: 'ბიზნესი', query: 'მენეჯმენტ' },
];

export function FeedPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [listings, setListings] = useState<SwapListing[]>([]);
  const [matches, setMatches] = useState<SmartMatch[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [stats, setStats] = useState({
    studentsCount: 0,
    openListingsCount: 0,
    completedSwapsCount: 0,
  });

  const [activeCategory, setActiveCategory] = useState('all');
  const [q, setQ] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lecturer, setLecturer] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [desiredTime, setDesiredTime] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [searchOpen, setSearchOpen] = useState(searchParams.get('search') === '1');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [offerModalListing, setOfferModalListing] = useState<SwapListing | null>(null);
  const [detailsModalListing, setDetailsModalListing] = useState<SwapListing | null>(null);
  const [reportModalListing, setReportModalListing] = useState<SwapListing | null>(null);

  useEffect(() => {
    if (searchParams.get('search') === '1') {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchParams]);

  useEffect(() => {
    apiRequest<{
      studentsCount: number;
      openListingsCount: number;
      completedSwapsCount: number;
    }>('/catalog/stats')
      .then(setStats)
      .catch(() => {});

    apiRequest<{ universities: University[] }>('/catalog/universities')
      .then((data) => {
        setUniversities(data.universities);
        const targetUni = user?.universityId || data.universities[0]?.id;
        if (targetUni) {
          apiRequest<{ courses: Course[]; lecturers: Lecturer[] }>(
            `/catalog/university/${targetUni}/academic`
          ).then((acad) => {
            setCourses(acad.courses);
            setLecturers(acad.lecturers);
          });
        }
      })
      .catch(() => {});

    if (user) {
      apiRequest<{ matches: SmartMatch[] }>('/listings/matches')
        .then((d) => setMatches(d.matches))
        .catch(() => {});
    }
  }, [user]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cat = CATEGORY_PILLS.find((c) => c.id === activeCategory);
      const effectiveQuery = q.trim() || cat?.query || '';

      const params = new URLSearchParams();
      if (effectiveQuery) params.set('q', effectiveQuery);
      if (universityId) params.set('universityId', universityId);
      if (courseId) params.set('courseId', courseId);
      if (lecturer.trim()) params.set('lecturer', lecturer.trim());
      if (currentTime.trim()) params.set('currentTime', currentTime.trim());
      if (desiredTime.trim()) params.set('desiredTime', desiredTime.trim());
      if (status) params.set('status', status);

      const data = await apiRequest<{ listings: SwapListing[] }>(`/listings?${params.toString()}`);
      const sorted = [...data.listings];
      if (sortBy === 'popular') {
        sorted.sort((a, b) => (b._count?.offers ?? 0) - (a._count?.offers ?? 0));
      }
      setListings(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'განცხადებების ჩატვირთვა ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, q, universityId, courseId, lecturer, currentTime, desiredTime, status, sortBy]);

  useEffect(() => {
    const timer = setTimeout(fetchListings, 180);
    return () => clearTimeout(timer);
  }, [fetchListings]);

  const requireAuthOr = (fn: () => void) => {
    if (!user) {
      showToast('გთხოვთ შეხვიდეთ სისტემაში ამ მოქმედებისთვის', 'info');
      navigate('/login');
      return;
    }
    fn();
  };

  const handleToggleSave = async (listingId: string) => {
    requireAuthOr(async () => {
      try {
        const res = await apiRequest<{ saved: boolean }>(`/listings/${listingId}/save`, {
          method: 'POST',
        });
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, isSaved: res.saved } : l))
        );
        showToast(res.saved ? 'განცხადება შენახულია' : 'წაიშალა შენახულებიდან', 'info');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'შეცდომა', 'error');
      }
    });
  };

  const handleDelete = async (listingId: string) => {
    try {
      await apiRequest(`/listings/${listingId}`, { method: 'DELETE' });
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      showToast('განცხადება წაიშალა', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'წაშლა ვერ მოხერხდა', 'error');
    }
  };

  const clearFilters = () => {
    setActiveCategory('all');
    setQ('');
    setUniversityId('');
    setCourseId('');
    setLecturer('');
    setCurrentTime('');
    setDesiredTime('');
    setStatus('OPEN');
  };

  const hasActiveFilters =
    activeCategory !== 'all' ||
    Boolean(q || universityId || courseId || lecturer || currentTime || desiredTime) ||
    status !== 'OPEN';

  return (
    <AppLayout
      onFocusSearch={() => {
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }}
    >
      <div className="space-y-5">
        {/* Hero Banner (exactly matching reference visual hierarchy) */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#6D28D9] text-white shadow-soft">
          <img
            src="/campus-hero.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-luminosity pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1E1B4B]/95 via-[#312E81]/80 to-[#4C1D95]/55" />

          <div className="relative p-6 sm:p-8 lg:p-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl space-y-3">
              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold leading-tight tracking-tight">
                შეცვალე საგანი,
                <br />
                იპოვე შენი იდეალური ჯგუფი!
              </h1>
              <p className="text-sm sm:text-base text-indigo-100/95 leading-relaxed">
                BTU სტუდენტებისთვის შექმნილი პლატფორმა საგნების, ლექტორებისა და ჯგუფების
                გადასაცვლელად.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  to={user ? '/listings/new' : '/register'}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold shadow-lg shadow-violet-950/30 transition"
                >
                  {user ? 'განცხადების დამატება' : 'დაიწყე ახლავე'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {!user && (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-bold transition"
                  >
                    შესვლა
                  </Link>
                )}
              </div>
            </div>

            {/* Two Glass Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:w-64 shrink-0">
              <div className="rounded-2xl bg-white/95 text-slate-900 px-4 py-3.5 shadow-md flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-extrabold leading-none">{stats.studentsCount}</p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    აქტიური სტუდენტი
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/95 text-slate-900 px-4 py-3.5 shadow-md flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-extrabold leading-none">
                    {stats.openListingsCount}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    აქტიური განცხადება
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Smart Match Strip (if user has mutual matches) */}
        {user && matches.length > 0 && (
          <Link
            to="/matches"
            className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-violet-50 border border-emerald-200/80 px-4 py-3 hover:border-emerald-300 transition"
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-900">
                ნაპოვნია {matches.length} ავტომატური დამთხვევა შენს განცხადებებზე!
              </span>
              <span className="hidden sm:inline text-slate-600">
                ({matches[0].matchedListing.courseName} · {matches[0].matchScore}%)
              </span>
            </div>
            <span className="text-xs font-extrabold text-violet-700 shrink-0">ნახვა →</span>
          </Link>
        )}

        {/* Category Pills + Sort + Search Toggle */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORY_PILLS.map((cat) => {
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      active
                        ? 'bg-violet-700 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setSearchOpen((v) => !v);
                  if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 60);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                  searchOpen || advancedOpen || q
                    ? 'bg-violet-50 border-violet-200 text-violet-700'
                    : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                ძიება
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'popular')}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="newest">უახლესი</option>
                <option value="popular">მეტი შეთავაზება</option>
              </select>
            </div>
          </div>

          {/* Expandable Search & Filters */}
          {(searchOpen || advancedOpen || q) && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="მოძებნე საგანი, ლექტორი, დრო (მაგ: 12:00) ან სტუდენტი..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <button
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  დამატებითი ფილტრები
                </button>
              </div>

              {advancedOpen && (
                <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="">ყველა საგანი</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>

                  <input
                    list="feed-lecturers"
                    value={lecturer}
                    onChange={(e) => setLecturer(e.target.value)}
                    placeholder="ლექტორი"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <datalist id="feed-lecturers">
                    {lecturers.map((l) => (
                      <option key={l.id} value={l.fullName} />
                    ))}
                  </datalist>

                  <input
                    value={currentTime}
                    onChange={(e) => setCurrentTime(e.target.value)}
                    placeholder="მიმდინარე დრო (16:00)"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />

                  <input
                    value={desiredTime}
                    onChange={(e) => setDesiredTime(e.target.value)}
                    placeholder="სასურველი დრო (12:00)"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />

                  <select
                    value={universityId}
                    onChange={(e) => setUniversityId(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="">ყველა უნივერსიტეტი</option>
                    {universities.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.shortName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="OPEN">მხოლოდ აქტიური</option>
                    <option value="MATCHED">შეთანხმებული</option>
                    <option value="COMPLETED">დასრულებული</option>
                    <option value="ALL">ყველა სტატუსი</option>
                  </select>
                </div>
              )}

              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                    ფილტრების გასუფთავება
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3-Column Feed Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 h-72 animate-pulse space-y-4"
              >
                <div className="h-4 bg-slate-100 rounded w-1/3" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="h-3.5 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="h-28 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
            <button
              onClick={fetchListings}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              თავიდან ცდა
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
            <p className="text-base font-bold text-slate-900">განცხადებები ვერ მოიძებნა</p>
            <p className="text-sm text-slate-500">
              სცადეთ სხვა კატეგორია ან თავად გამოაქვეყნეთ გაცვლის განცხადება.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
                >
                  ფილტრების გასუფთავება
                </button>
              )}
              <Link
                to={user ? '/listings/new' : '/register'}
                className="px-4 py-2 rounded-xl bg-violet-700 text-white text-sm font-semibold"
              >
                განცხადების დამატება
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onProposeOffer={(l) => requireAuthOr(() => setOfferModalListing(l))}
                onOpenDetails={setDetailsModalListing}
                onToggleSave={handleToggleSave}
              />
            ))}
          </div>
        )}
      </div>

      <ProposeOfferModal
        listing={offerModalListing}
        onClose={() => setOfferModalListing(null)}
        onSuccess={fetchListings}
      />
      <ListingDetailsModal
        listing={detailsModalListing}
        onClose={() => setDetailsModalListing(null)}
        onProposeOffer={(l) => requireAuthOr(() => setOfferModalListing(l))}
        onReport={(l) => requireAuthOr(() => setReportModalListing(l))}
        onDelete={handleDelete}
      />
      <ReportModal listing={reportModalListing} onClose={() => setReportModalListing(null)} />
    </AppLayout>
  );
}

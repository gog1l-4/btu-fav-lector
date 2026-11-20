import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-30 glass-surface border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-sm shadow-soft">
              SU
            </div>
            <span className="font-extrabold text-xl tracking-tight">
              Swap<span className="text-indigo-600">U</span>
            </span>
            <span className="hidden sm:inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              BTU Beta
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/feed"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition"
              >
                პლატფორმაზე გადასვლა
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  შესვლა
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition"
                >
                  რეგისტრაცია
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[780px] h-[360px] bg-gradient-to-tr from-indigo-100/70 via-violet-100/60 to-sky-100/50 blur-3xl rounded-full pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              შექმნილია BTU-ს სტუდენტებისთვის
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.18]">
              გაცვალე სასწავლო ჯგუფი და ლექციის დრო{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                წამებში
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              აღარ მოგიწიოს Facebook-ის ჯგუფებში პოსტების ძებნა და კომენტარებში კარგვა.
              გამოაქვეყნე სტრუქტურირებული განცხადება, იპოვე გაცვლის პარტნიორი და შეთანხმდი
              ერთ ორგანიზებულ სივრცეში.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={user ? '/feed' : '/register'}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-soft transition"
              >
                {user ? 'ფიდზე გადასვლა' : 'დაიწყე უფასოდ'}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-sm transition"
              >
                უკვე მაქვს ანგარიში
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                სტუდენტური ვერიფიკაცია
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                რეალურ დროში ჩატი
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ავტომატური დამთხვევები
              </span>
            </div>
          </div>

          {/* Interactive Preview Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xl shadow-indigo-950/5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-sm flex items-center justify-center">
                    ნწ
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">ნინო წიკლაური</p>
                    <p className="text-xs text-slate-500">BTU · ინფორმაციული ტექნოლოგიები</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  აქტიური
                </span>
              </div>

              <div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700">
                  IT-204
                </span>
                <h3 className="font-bold text-base mt-2">Front-end ვებ-პროგრამირება</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                  <p className="font-bold text-slate-400 uppercase text-[10px]">მაქვს</p>
                  <p className="font-bold text-slate-900 mt-1">16:00 · ორშაბათი</p>
                  <p className="text-slate-600 mt-0.5">რევაზ მაკალათია</p>
                </div>
                <div className="rounded-xl bg-indigo-50/70 border border-indigo-200/80 p-3">
                  <p className="font-bold text-indigo-600 uppercase text-[10px]">მინდა</p>
                  <p className="font-bold text-indigo-700 mt-1">12:00 · ორშაბათი</p>
                  <p className="text-slate-700 mt-0.5">რევაზ მაკალათია</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  100% დამთხვევა ნაპოვნია
                </span>
                <Link
                  to={user ? '/feed' : '/register'}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  გაცვლის შეთავაზება
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — 3 steps */}
      <section className="py-16 sm:py-24 bg-slate-50/80 border-y border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              როგორ მუშაობს SwapU
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              მხოლოდ 3 მარტივი ნაბიჯი სასურველი ლექციის დროის მისაღებად
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'გამოაქვეყნე განცხადება',
                desc: 'მიუთითე საგანი, მიმდინარე ლექტორი, ჯგუფის დრო და რა დროში გსურს გადასვლა.',
                icon: Clock,
              },
              {
                step: '02',
                title: 'მიიღე ან გაგზავნე შეთავაზება',
                desc: 'იპოვე შესაბამისი სტუდენტი ფილტრებით ან Smart Matching-ით და გაუგზავნე შეთავაზება.',
                icon: Search,
              },
              {
                step: '03',
                title: 'შეთანხმდი ჩატში',
                desc: 'დაადასტურეთ გაცვლა და დაუკავშირდით ერთმანეთს პირდაპირ ჩატში უნივერსიტეტში გაფორმებამდე.',
                icon: MessageSquare,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-slate-300">{item.step}</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              რატომ ჯობია SwapU ქაოსურ ჯგუფებს
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Search,
                title: 'ზუსტი ფილტრაცია',
                desc: 'გაფილტრე საგნით, ლექტორით, მიმდინარე და სასურველი დროით წამებში.',
              },
              {
                icon: Sparkles,
                title: 'Smart Matching',
                desc: 'სისტემა თავად პოულობს ორმხრივ დამთხვევებს და გაცნობებს.',
              },
              {
                icon: ShieldCheck,
                title: 'დაცული შეთანხმება',
                desc: 'ერთ განცხადებაზე ორი ურთიერთგამომრიცხავი გაცვლა არ დადასტურდება.',
              },
              {
                icon: BellRing,
                title: 'მყისიერი შეტყობინებები',
                desc: 'მიიღე შეთავაზებები საიტზეც და ელფოსტაზეც, რომ არაფერი გამოგრჩეს.',
              },
            ].map((adv) => {
              const Icon = adv.icon;
              return (
                <div
                  key={adv.title}
                  className="rounded-2xl border border-slate-200/80 p-5 bg-white shadow-card"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{adv.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    {adv.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 p-8 sm:p-12 text-white shadow-soft flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-bold bg-white/15 px-3 py-1 rounded-full">
              <Users className="w-3.5 h-3.5" />
              შეუერთდი სტუდენტურ ქსელს
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">
              მოაწესრიგე შენი სემესტრის ცხრილი დღესვე
            </h2>
            <p className="text-indigo-100 text-sm sm:text-base max-w-xl">
              დარეგისტრირდი @btu.edu.ge ელფოსტით ავტომატური ვერიფიკაციისთვის ან გამოიყენე
              სტუდენტური ID.
            </p>
          </div>
          <Link
            to={user ? '/feed' : '/register'}
            className="shrink-0 px-6 py-3.5 rounded-2xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition shadow-md"
          >
            {user ? 'ფიდზე გადასვლა' : 'შექმენი ანგარიში'}
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} SwapU — სტუდენტური კურსებისა და ჯგუფების გაცვლის პლატფორმა
      </footer>
    </div>
  );
}

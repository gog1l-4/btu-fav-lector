import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { University, User } from '../types';

function MinimalAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-[360px] mx-auto text-center">
        <Link to="/" className="inline-block mb-3">
          <span className="font-extrabold text-[32px] tracking-tight text-[#111827]">
            Swap<span className="text-violet-700">U</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}

function isEduGeEmail(value: string): boolean {
  return /^[^\s@]+@([a-z0-9-]+\.)*edu\.ge$/i.test(value.trim());
}

export function LoginPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [linkSent, setLinkSent] = useState(false);
  const [devMagicUrl, setDevMagicUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !isEduGeEmail(trimmed)) {
      setEmailError('გამოიყენე საუნივერსიტეტო ელ. ფოსტა');
      return;
    }

    setEmailError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        message: string;
        email: string;
        devMagicUrl?: string;
      }>('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed }),
      });
      setDevMagicUrl(res.devMagicUrl || null);
      setLinkSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'შეცდომა ავტორიზაციისას';
      setEmailError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (linkSent) {
    return (
      <MinimalAuthShell>
        <div className="mt-4 flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#242933] text-white flex items-center justify-center shadow-sm">
            <MailCheck className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold text-slate-900 leading-snug">
              შესვლის ლინკი
              <br />
              გამოგეგზავნა
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
              გადაამოწმე ელ. ფოსტა (<strong className="text-slate-700">{email}</strong>) და
              დააჭირე ღილაკს სისტემაში შესასვლელად.
            </p>
          </div>

          {devMagicUrl && (
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={() => {
                  const url = new URL(devMagicUrl);
                  navigate(`${url.pathname}${url.search}`);
                }}
                className="w-full py-3.5 px-5 rounded-full bg-violet-700 hover:bg-violet-800 text-white text-sm font-bold shadow-sm transition inline-flex items-center justify-center gap-2"
              >
                სატესტო რეჟიმი: ლინკზე გადასვლა
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[11px] text-slate-400 mt-1.5">
                სატესტო ვერსიაში იმეილზე გაგზავნის ნაცვლად შეგიძლია პირდაპირ გადახვიდე
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setLinkSent(false);
              setDevMagicUrl(null);
            }}
            className="w-full py-3.5 px-5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
          >
            ელ. ფოსტის შეცვლა
          </button>

          <p className="text-[11px] text-slate-400 pt-4">
            SwapU · სტუდენტური გაცვლის პლატფორმა
          </p>
        </div>
      </MinimalAuthShell>
    );
  }

  return (
    <MinimalAuthShell>
      <h1 className="text-xl font-extrabold text-slate-900 mb-6">სისტემაში შესვლა</h1>

      <form onSubmit={handleSubmit} className="space-y-3 text-left" noValidate>
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            placeholder="ელ. ფოსტა (მაგ: name@btu.edu.ge)"
            className={`w-full rounded-full border px-5 py-3.5 text-sm outline-none transition ${
              emailError
                ? 'border-rose-400 bg-rose-50/70 text-slate-900 focus:border-rose-500'
                : 'border-slate-300 bg-white text-slate-900 focus:border-slate-800'
            }`}
          />
          {emailError && (
            <p className="mt-1.5 pl-3 text-[11px] font-semibold text-rose-500">{emailError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-5 rounded-full bg-[#242933] hover:bg-[#161920] disabled:opacity-60 text-white text-sm font-semibold transition"
        >
          {submitting ? 'იგზავნება...' : 'ავტორიზაცია'}
        </button>

        <Link
          to="/about"
          className="block w-full text-center py-3.5 px-5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
        >
          პლატფორმის შესახებ
        </Link>
      </form>

      {/* Quick Demo Accounts for Fast Testing */}
      <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 text-left space-y-2">
        <p className="text-[11px] font-bold text-slate-500">სწრაფი სატესტო ელ. ფოსტები:</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            'nino.tsiklauri@btu.edu.ge',
            'giorgi.kvaratskhelia@btu.edu.ge',
            'admin@btu.edu.ge',
          ].map((demoEmail) => (
            <button
              key={demoEmail}
              type="button"
              onClick={() => {
                setEmail(demoEmail);
                setEmailError(null);
                showToast('ჩაისვა სატესტო ელ. ფოსტა', 'info');
              }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-violet-400 hover:text-violet-700 transition"
            >
              {demoEmail}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-6">
        SwapU · მხოლოდ .edu.ge საუნივერსიტეტო ელ. ფოსტით
      </p>
    </MinimalAuthShell>
  );
}

export function MagicVerifyPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { setSessionToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [state, setState] = useState<'verifying' | 'register' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  const [email, setEmail] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studyYear, setStudyYear] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg('შესვლის ბმული არავალიდურია');
      return;
    }

    apiRequest<{
      requiresRegistration: boolean;
      token?: string;
      user?: User;
      email?: string;
      detectedUniversity?: University | null;
      universities?: University[];
    }>('/auth/magic-verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.requiresRegistration && res.token) {
          await setSessionToken(res.token);
          showToast('წარმატებით შეხვედით სისტემაში!', 'success');
          navigate('/', { replace: true });
          return;
        }

        setEmail(res.email || '');
        const unis = res.universities || [];
        setUniversities(unis);
        const targetUni = res.detectedUniversity || unis[0];
        if (targetUni) {
          setUniversityId(targetUni.id);
          if (targetUni.faculties?.[0]) {
            setFacultyId(targetUni.faculties[0].id);
          }
        }
        setState('register');
      })
      .catch((err) => {
        setState('error');
        setErrorMsg(err instanceof Error ? err.message : 'შესვლის ბმული ვადაგასულია');
      });
  }, [token]);

  const selectedUni = universities.find((u) => u.id === universityId);
  const faculties = selectedUni?.faculties || [];

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ token: string }>('/auth/magic-complete', {
        method: 'POST',
        body: JSON.stringify({
          token,
          firstName,
          lastName,
          universityId,
          facultyId: facultyId || null,
          studyYear,
        }),
      });
      await setSessionToken(res.token);
      showToast('რეგისტრაცია დასრულდა! სესია დამახსოვრებულია.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'რეგისტრაცია ვერ მოხერხდა', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'verifying') {
    return (
      <MinimalAuthShell>
        <div className="py-8 space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-violet-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">მიმდინარეობს ავტორიზაცია...</p>
        </div>
      </MinimalAuthShell>
    );
  }

  if (state === 'error') {
    return (
      <MinimalAuthShell>
        <div className="py-6 space-y-4">
          <p className="text-sm font-semibold text-rose-600">{errorMsg}</p>
          <Link
            to="/login"
            className="inline-block w-full py-3.5 px-5 rounded-full bg-[#242933] text-white text-sm font-semibold"
          >
            თავიდან ცდა
          </Link>
        </div>
      </MinimalAuthShell>
    );
  }

  return (
    <MinimalAuthShell>
      <div className="text-left bg-white rounded-3xl border border-slate-200/90 p-6 shadow-card mt-2">
        <h1 className="text-lg font-extrabold text-slate-900">დაასრულე რეგისტრაცია</h1>
        <p className="text-xs text-slate-500 mt-1">{email} · ვერიფიცირებული</p>

        <form onSubmit={handleCompleteRegistration} className="mt-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">სახელი *</label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="სახელი"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">გვარი *</label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="გვარი"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              უნივერსიტეტი *
            </label>
            <select
              value={universityId}
              onChange={(e) => {
                const nextId = e.target.value;
                setUniversityId(nextId);
                const nextUni = universities.find((u) => u.id === nextId);
                setFacultyId(nextUni?.faculties?.[0]?.id || '');
              }}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white"
            >
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">ფაკულტეტი</label>
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs bg-white"
              >
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">კურსი</label>
              <select
                value={studyYear}
                onChange={(e) => setStudyYear(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-2.5 py-2.5 text-xs bg-white"
              >
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    {y} კურსი
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full bg-[#242933] hover:bg-[#161920] text-white text-sm font-bold transition"
          >
            {submitting ? 'იქმნება...' : 'პლატფორმაზე შესვლა'}
          </button>
        </form>
      </div>
    </MinimalAuthShell>
  );
}

export function RegisterPage() {
  return <LoginPage />;
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { refreshMe } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('ვერიფიკაციის ტოკენი არ არის მითითებული');
      return;
    }
    apiRequest<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        setStatus('success');
        setMessage(res.message);
        await refreshMe();
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'ვერიფიკაცია ვერ მოხერხდა');
      });
  }, [token]);

  return (
    <MinimalAuthShell>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 mt-4 space-y-4">
        <h1 className="text-lg font-extrabold text-slate-900">ელფოსტის დადასტურება</h1>
        {status === 'loading' && (
          <p className="text-sm text-slate-600 py-4">მიმდინარეობს შემოწმება...</p>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-slate-700">{message}</p>
            <Link
              to="/"
              className="inline-block w-full py-3 rounded-full bg-violet-700 text-white text-sm font-bold"
            >
              პლატფორმაზე გადასვლა
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-sm font-medium text-rose-600">{message}</p>
            <Link to="/login" className="inline-block text-sm font-bold text-violet-700">
              შესვლის გვერდზე დაბრუნება
            </Link>
          </>
        )}
      </div>
    </MinimalAuthShell>
  );
}

export function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
      showToast(data.message, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეცდომა', 'error');
    }
  };

  return (
    <MinimalAuthShell>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 mt-4 text-left space-y-4">
        <h1 className="text-lg font-extrabold text-slate-900">პაროლის აღდგენა</h1>
        {sent ? (
          <div className="text-center space-y-3 py-2">
            <Mail className="w-10 h-10 text-violet-700 mx-auto" />
            <p className="text-xs text-slate-600">აღდგენის ბმული გამოგზავნილია.</p>
            <Link to="/login" className="text-xs font-bold text-violet-700">
              შესვლაზე დაბრუნება
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@btu.edu.ge"
              className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-[#242933] text-white text-sm font-bold"
            >
              გაგზავნა
            </button>
          </form>
        )}
      </div>
    </MinimalAuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      showToast('პაროლი განახლდა', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეცდომა', 'error');
    }
  };

  return (
    <MinimalAuthShell>
      <div className="bg-white rounded-3xl border border-slate-200 p-6 mt-4 text-left space-y-4">
        <h1 className="text-lg font-extrabold text-slate-900">ახალი პაროლი</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ახალი პაროლი"
            className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-full bg-[#242933] text-white text-sm font-bold"
          >
            შენახვა
          </button>
        </form>
      </div>
    </MinimalAuthShell>
  );
}

// Keep ShieldCheck import referenced cleanly for future verification badge helpers if needed
export { ShieldCheck };

import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { setStudentAuth, studentApiRequest } from '../../utils/studentAuth';

interface BtuOtpModalProps {
  isOpen: boolean;
  reason?: 'vote_limit' | 'upload' | 'account';
  onClose: () => void;
  onSuccess: (email: string) => void;
}

export function BtuOtpModal({ isOpen, reason = 'vote_limit', onClose, onSuccess }: BtuOtpModalProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setStep('email');
      setCode('');
      setDevCodeHint(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const trimmedEmail = email.trim().toLowerCase();
  const isEmailValid = /^[a-z0-9._%+-]+@btu\.edu\.ge$/i.test(trimmedEmail);

  async function handleRequestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isEmailValid) {
      showToast('გამოიყენე მხოლოდ @btu.edu.ge ელ. ფოსტა', 'error');
      return;
    }

    try {
      setLoading(true);
      const data = await studentApiRequest<{
        success: boolean;
        message: string;
        devMode?: boolean;
        devCode?: string;
      }>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail }),
      });

      setStep('code');
      setCooldown(30);
      if (data.devMode && data.devCode) {
        setDevCodeHint(data.devCode);
      } else {
        setDevCodeHint(null);
      }
      showToast(data.message || '6-ნიშნა კოდი გაიგზავნა მეილზე!', 'success');
    } catch (err: any) {
      showToast(err.message || 'კოდის გაგზავნა ვერ მოხერხდა', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = code.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      showToast('შეიყვანეთ 6-ნიშნა კოდი', 'error');
      return;
    }

    try {
      setLoading(true);
      const data = await studentApiRequest<{
        success: boolean;
        token: string;
        email: string;
        message: string;
      }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail, code: cleanCode }),
      });

      setStudentAuth(data.token, data.email);
      showToast(data.message || 'წარმატებით შეხვედი!', 'success');
      onSuccess(data.email);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'კოდი არასწორია', 'error');
    } finally {
      setLoading(false);
    }
  }

  const subtitle =
    reason === 'upload'
      ? 'ფოტოს ასატვირთად დაადასტურე, რომ BTU-ს სტუდენტი ხარ — პაროლის გარეშე, 15 წამში.'
      : reason === 'vote_limit'
      ? 'პირველი 3 წყვილი შეაფასე! გასაგრძელებლად დაადასტურე შენი @btu.edu.ge მეილი.'
      : 'შედი შენი @btu.edu.ge ელ. ფოსტით 6-ნიშნა კოდით.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#12151D] border border-[#D8BE93]/25 rounded-3xl p-6 shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-[#D8BE93]/15 border border-[#D8BE93]/35 text-[#D8BE93] flex items-center justify-center mx-auto">
            {step === 'email' ? <Mail className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h3 className="text-xl font-black text-white font-title">
            {step === 'email' ? 'BTU ვერიფიკაცია' : 'შეიყვანე 6-ნიშნა კოდი'}
          </h3>
          <p className="text-xs text-stone-400 leading-relaxed max-w-xs mx-auto">
            {step === 'email'
              ? subtitle
              : `კოდი გაიგზავნა მისამართზე ${trimmedEmail}. შეამოწმე Inbox ან Spam ფოლდერი.`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-400 block">
                BTU-ს ელ. ფოსტა
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="saxeli.gvari@btu.edu.ge"
                autoFocus
                required
                className="w-full px-4 py-3.5 rounded-2xl bg-[#0B0D12] border border-white/10 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-[#D8BE93]/60 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3.5 rounded-2xl bg-[#D8BE93] hover:bg-[#C8A97E] disabled:opacity-50 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-[#D8BE93]/15"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>იგზავნება...</span>
                </>
              ) : (
                <>
                  <span>კოდის გაგზავნა</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-stone-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C8A97E]" />
              <span>მეილი საჯაროდ არასდროს გამოჩნდება</span>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {devCodeHint && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-200">
                ლოკალური ტესტის კოდი: <strong className="font-mono text-sm tracking-widest">{devCodeHint}</strong>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-400 block text-center">
                6-ნიშნა კოდი
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                required
                className="w-full px-4 py-4 rounded-2xl bg-[#0B0D12] border border-[#D8BE93]/35 text-[#E8D3AD] placeholder-stone-600 text-center text-2xl font-mono font-black tracking-[0.5em] focus:outline-none focus:border-[#D8BE93] transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-3.5 rounded-2xl bg-[#D8BE93] hover:bg-[#C8A97E] disabled:opacity-50 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-[#D8BE93]/15"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>მოწმდება...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>დადასტურება და შესვლა</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                }}
                className="text-stone-400 hover:text-white transition cursor-pointer"
              >
                ← მეილის შეცვლა
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={() => handleRequestOtp()}
                className="text-[#D8BE93] hover:text-[#E8D3AD] disabled:text-stone-600 transition cursor-pointer"
              >
                {cooldown > 0 ? `თავიდან გაგზავნა (${cooldown}წ)` : 'კოდის თავიდან გაგზავნა'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

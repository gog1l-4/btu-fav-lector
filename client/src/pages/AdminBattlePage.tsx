import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import type { LectorBattle } from '../types';

const ADMIN_PIN_KEY = 'btu_admin_session_pin';

export function AdminBattlePage() {
  const [pin, setPin] = useState(sessionStorage.getItem(ADMIN_PIN_KEY) || '');
  const [isPinValid, setIsPinValid] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [checkingPin, setCheckingPin] = useState(false);

  const [battles, setBattles] = useState<LectorBattle[]>([]);
  const [loadingBattles, setLoadingBattles] = useState(false);

  // Form states
  const [title, setTitle] = useState('🔥 BTU: კვირის ბრძოლა');
  const [description, setDescription] = useState('მიეცი ხმა შენს ფავორიტ ლექტორს! შედეგები რეალურ დროში განახლდება.');
  const [lector1Name, setLector1Name] = useState('');
  const [lector1Subject, setLector1Subject] = useState('');
  const [lector1Photo, setLector1Photo] = useState('');
  const [lector2Name, setLector2Name] = useState('');
  const [lector2Subject, setLector2Subject] = useState('');
  const [lector2Photo, setLector2Photo] = useState('');
  const [setActiveNow, setSetActiveNow] = useState(true);

  // Uploading states
  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);
  const [creating, setCreating] = useState(false);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const { showToast } = useToast();

  // Verify stored PIN on mount
  useEffect(() => {
    if (pin) {
      verifyPin(pin);
    }
  }, []);

  async function verifyPin(pinToTest: string) {
    try {
      setCheckingPin(true);
      const res = await fetch('/api/battles/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToTest }),
      });
      if (res.ok) {
        setIsPinValid(true);
        sessionStorage.setItem(ADMIN_PIN_KEY, pinToTest);
        setPin(pinToTest);
        fetchBattles(pinToTest);
      } else {
        setIsPinValid(false);
        sessionStorage.removeItem(ADMIN_PIN_KEY);
        showToast('არასწორი PIN კოდი', 'error');
      }
    } catch {
      setIsPinValid(false);
      showToast('კავშირის შეცდომა', 'error');
    } finally {
      setCheckingPin(false);
    }
  }

  async function fetchBattles(adminPin: string) {
    try {
      setLoadingBattles(true);
      const res = await fetch('/api/battles', {
        headers: { 'x-admin-pin': adminPin },
      });
      if (res.ok) {
        const data = await res.json();
        setBattles(data.battles || []);
      }
    } catch (err: any) {
      showToast('ბრძოლების ჩატვირთვა ვერ მოხერხდა', 'error');
    } finally {
      setLoadingBattles(false);
    }
  }

  // Upload / Process Photo handler
  async function handleFileUpload(file: File, lectorNum: 1 | 2) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('გთხოვთ აირჩიოთ სურათის ფორმატი (JPG, PNG, WebP)', 'error');
      return;
    }

    const setUploading = lectorNum === 1 ? setUploading1 : setUploading2;
    const setPhoto = lectorNum === 1 ? setLector1Photo : setLector2Photo;

    try {
      setUploading(true);

      // Convert and compress directly in browser so it works 100% reliably on Cloud
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPhoto(optimizedDataUrl);
          setUploading(false);
          showToast(`ლექტორი ${lectorNum}-ის ფოტო მზადაა! 📸`, 'success');
        };
        img.onerror = () => {
          setPhoto(rawUrl);
          setUploading(false);
          showToast(`ლექტორი ${lectorNum}-ის ფოტო აიტვირთა!`, 'success');
        };
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploading(false);
      showToast(err.message || 'სურათის დამუშავება ვერ მოხერხდა', 'error');
    }
  }

  // Create Battle handler
  async function handleCreateBattle(e: React.FormEvent) {
    e.preventDefault();

    if (!lector1Name.trim() || !lector2Name.trim()) {
      showToast('გთხოვთ შეიყვანოთ ორივე ლექტორის სახელი', 'error');
      return;
    }

    if (!lector1Photo.trim() || !lector2Photo.trim()) {
      showToast('გთხოვთ ატვირთოთ ან მიუთითოთ ორივე ლექტორის ფოტო', 'error');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/battles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          lector1Name: lector1Name.trim(),
          lector1Subject: lector1Subject.trim(),
          lector1Photo: lector1Photo.trim(),
          lector2Name: lector2Name.trim(),
          lector2Subject: lector2Subject.trim(),
          lector2Photo: lector2Photo.trim(),
          isActive: setActiveNow,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'ბრძოლის შექმნა ვერ მოხერხდა');
      }

      showToast('ახალი ბრძოლა წარმატებით შეიქმნა! 🚀', 'success');

      // Reset form
      setLector1Name('');
      setLector1Subject('');
      setLector1Photo('');
      setLector2Name('');
      setLector2Subject('');
      setLector2Photo('');

      // Refresh list
      fetchBattles(pin);
    } catch (err: any) {
      showToast(err.message || 'შეცდომა ბრძოლის შექმნისას', 'error');
    } finally {
      setCreating(false);
    }
  }

  // Toggle active
  async function handleSetActive(battleId: string) {
    try {
      const res = await fetch(`/api/battles/${battleId}/active`, {
        method: 'PATCH',
        headers: { 'x-admin-pin': pin },
      });
      if (res.ok) {
        showToast('ბრძოლა გააქტიურებულია მთავარ გვერდზე!', 'success');
        fetchBattles(pin);
      }
    } catch {
      showToast('გააქტიურება ვერ მოხერხდა', 'error');
    }
  }

  // Reset votes
  async function handleResetVotes(battleId: string) {
    if (!window.confirm('ნამდვილად გსურთ ხმების 0-ზე განულება?')) return;
    try {
      const res = await fetch(`/api/battles/${battleId}/reset-votes`, {
        method: 'POST',
        headers: { 'x-admin-pin': pin },
      });
      if (res.ok) {
        showToast('ხმები განულებულია!', 'success');
        fetchBattles(pin);
      }
    } catch {
      showToast('განულება ვერ მოხერხდა', 'error');
    }
  }

  // Delete battle
  async function handleDeleteBattle(battleId: string) {
    if (!window.confirm('ნამდვილად გსურთ ამ ბრძოლის წაშლა?')) return;
    try {
      const res = await fetch(`/api/battles/${battleId}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin },
      });
      if (res.ok) {
        showToast('ბრძოლა წაშლილია', 'success');
        fetchBattles(pin);
      }
    } catch {
      showToast('წაშლა ვერ მოხერხდა', 'error');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_PIN_KEY);
    setIsPinValid(false);
    setPin('');
  }

  // PIN Gate Screen
  if (!isPinValid) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center space-y-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white">Fav Lector ადმინი</h1>
            <p className="text-xs text-slate-400">
              შეიყვანეთ ადმინისტრატორის PIN კოდი (default: <code className="text-indigo-300">btu2026</code>)
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyPin(pinInput);
            }}
            className="space-y-4"
          >
            <div>
              <input
                type="password"
                placeholder="შეიყვანეთ PIN კოდი..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-center text-lg tracking-widest font-mono focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={checkingPin || !pinInput}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              {checkingPin ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>მოწმდება...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>შესვლა</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link to="/" className="text-xs text-slate-500 hover:text-slate-400 transition">
                ← დაბრუნება მთავარ გვერდზე
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="მთავარზე გადასვლა"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-bold text-white text-base flex items-center gap-2">
                <span>Fav Lector ადმინ პანელი</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ავტორიზებული
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">მართე ლექტორთა ბრძოლები და ფოტოები</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              target="_blank"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>ლაივ გვერდი</span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold transition"
            >
              გასვლა
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 space-y-10 flex-1">
        {/* SECTION 1: CREATE NEW BATTLE */}
        <section className="bg-slate-900/70 border border-slate-800/90 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ახალი ბრძოლის შექმნა</h2>
              <p className="text-xs text-slate-400">
                შეიყვანეთ ლექტორების სახელები, საგნები და ატვირთეთ ფოტოები
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateBattle} className="space-y-6">
            {/* Title & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  ბრძოლის სათაური
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="მაგ: 🔥 BTU: კვირის ბრძოლა"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  აღწერა / კითხვა
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="მაგ: რომელ ლექტორს ანიჭებ უპირატესობას?"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* TWO LECTURERS SIDE-BY-SIDE SETUP */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* LECTURER 1 SETUP */}
              <div className="bg-slate-950/60 border border-indigo-900/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    ლექტორი 1 (ლურჯი მხარე)
                  </span>
                  <span className="text-[11px] text-slate-500">ვარიანტი A</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ლექტორის სახელი და გვარი *
                  </label>
                  <input
                    type="text"
                    required
                    value={lector1Name}
                    onChange={(e) => setLector1Name(e.target.value)}
                    placeholder="მაგ: რევაზ მაკალათია"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    საგანი ან მიმართულება
                  </label>
                  <input
                    type="text"
                    value={lector1Subject}
                    onChange={(e) => setLector1Subject(e.target.value)}
                    placeholder="მაგ: Front-end Development"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                {/* Photo Upload & Preview */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    ლექტორი 1-ის ფოტო *
                  </label>

                  <div className="flex gap-4 items-start">
                    {/* Exact Aspect-Ratio Preview Box */}
                    <div className="w-24 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative flex items-center justify-center">
                      {lector1Photo ? (
                        <img
                          src={lector1Photo}
                          alt="Preview 1"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-700" />
                      )}
                      {uploading1 && (
                        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                          <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef1}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(e.target.files[0], 1);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef1.current?.click()}
                        disabled={uploading1}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploading1 ? 'იტვირთება...' : 'ფოტოს ატვირთვა'}</span>
                      </button>

                      <input
                        type="url"
                        value={lector1Photo}
                        onChange={(e) => setLector1Photo(e.target.value)}
                        placeholder="ან ჩასვით ფოტოს პირდაპირი URL"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    💡 ფოტო ავტომატურად მორგებულია (Cover). არ გაიწელება და არ დამახინჯდება.
                  </p>
                </div>
              </div>

              {/* LECTURER 2 SETUP */}
              <div className="bg-slate-950/60 border border-pink-900/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                    ლექტორი 2 (ვარდისფერი მხარე)
                  </span>
                  <span className="text-[11px] text-slate-500">ვარიანტი B</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ლექტორის სახელი და გვარი *
                  </label>
                  <input
                    type="text"
                    required
                    value={lector2Name}
                    onChange={(e) => setLector2Name(e.target.value)}
                    placeholder="მაგ: დავით კაპანაძე"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-pink-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    საგანი ან მიმართულება
                  </label>
                  <input
                    type="text"
                    value={lector2Subject}
                    onChange={(e) => setLector2Subject(e.target.value)}
                    placeholder="მაგ: Algorithms & Data Structures"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-pink-500 transition"
                  />
                </div>

                {/* Photo Upload & Preview */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    ლექტორი 2-ის ფოტო *
                  </label>

                  <div className="flex gap-4 items-start">
                    {/* Exact Aspect-Ratio Preview Box */}
                    <div className="w-24 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative flex items-center justify-center">
                      {lector2Photo ? (
                        <img
                          src={lector2Photo}
                          alt="Preview 2"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-700" />
                      )}
                      {uploading2 && (
                        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                          <RefreshCw className="w-5 h-5 text-pink-400 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef2}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(e.target.files[0], 2);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef2.current?.click()}
                        disabled={uploading2}
                        className="w-full py-2 px-3 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 text-pink-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploading2 ? 'იტვირთება...' : 'ფოტოს ატვირთვა'}</span>
                      </button>

                      <input
                        type="url"
                        value={lector2Photo}
                        onChange={(e) => setLector2Photo(e.target.value)}
                        placeholder="ან ჩასვით ფოტოს პირდაპირი URL"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-pink-500 transition"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    💡 ფოტო ავტომატურად მორგებულია (Cover). არ გაიწელება და არ დამახინჯდება.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={setActiveNow}
                  onChange={(e) => setSetActiveNow(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-0"
                />
                <span>დაყენდეს ეს ბრძოლა მაშინვე აქტიურად მთავარ გვერდზე</span>
              </label>

              <button
                type="submit"
                disabled={creating || uploading1 || uploading2}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>იქმნება...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    <span>ბრძოლის გამოქვეყნება</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* SECTION 2: EXISTING BATTLES MANAGEMENT */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>ყველა ბრძოლა</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({battles.length} ბრძოლა სისტემაში)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                აქედან შეგიძლია ნებისმიერი ბრძოლა ერთი დაკლიკებით გახადო აქტიური ან გაანულო ხმები
              </p>
            </div>

            <button
              onClick={() => fetchBattles(pin)}
              disabled={loadingBattles}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="განახლება"
            >
              <RefreshCw className={`w-4 h-4 ${loadingBattles ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {battles.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-500 text-xs">
              ბრძოლები ჯერ არ არის შექმნილი. შექმენი პირველი ბრძოლა ზემოთ მოცემული ფორმით!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {battles.map((b) => (
                <div
                  key={b.id}
                  className={`bg-slate-900/80 border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all shadow-md ${
                    b.isActive
                      ? 'border-emerald-500/80 bg-emerald-950/10 ring-2 ring-emerald-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Lecturers & Photos */}
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {/* Small Versus Avatars */}
                    <div className="flex items-center -space-x-3">
                      <img
                        src={b.lector1Photo}
                        alt={b.lector1Name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border-2 border-indigo-500 shadow"
                      />
                      <img
                        src={b.lector2Photo}
                        alt={b.lector2Name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border-2 border-pink-500 shadow"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">
                          {b.lector1Name} <span className="text-slate-500 font-normal">VS</span> {b.lector2Name}
                        </h3>
                        {b.isActive && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            აქტიური
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {b.title} • {b.lector1Votes} ხმა ({b.lector1Percent}%) vs {b.lector2Votes} ხმა ({b.lector2Percent}%)
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    {!b.isActive && (
                      <button
                        onClick={() => handleSetActive(b.id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>აქტიურად დაყენება</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleResetVotes(b.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition"
                      title="ხმების განულება"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteBattle(b.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                      title="წაშლა"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
export default AdminBattlePage;

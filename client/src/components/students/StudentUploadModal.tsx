import React, { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Instagram,
  RefreshCw,
  Sparkles,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { StudentGender, StudentRelationType } from '../../types';
import { compressPortraitPhoto, studentApiRequest } from '../../utils/studentAuth';

interface StudentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  onRequireAuth: () => void;
}

export function StudentUploadModal({
  isOpen,
  onClose,
  onSubmitted,
  onRequireAuth,
}: StudentUploadModalProps) {
  const [relationType, setRelationType] = useState<StudentRelationType>('SELF');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<StudentGender | ''>('');
  const [instagram, setInstagram] = useState('');
  const [photo, setPhoto] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  async function handleFileSelected(file?: File | null) {
    if (!file) return;
    try {
      setProcessingPhoto(true);
      const dataUrl = await compressPortraitPhoto(file);
      setPhoto(dataUrl);
    } catch (err: any) {
      showToast(err.message || 'ფოტოს დამუშავება ვერ მოხერხდა', 'error');
    } finally {
      setProcessingPhoto(false);
    }
  }

  function resetForm() {
    setName('');
    setGender('');
    setInstagram('');
    setPhoto('');
    setConsentConfirmed(false);
    setRelationType('SELF');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      showToast('გთხოვთ ატვირთოთ ფოტო', 'error');
      return;
    }
    if (name.trim().length < 2) {
      showToast('შეიყვანეთ სახელი (მინიმუმ 2 სიმბოლო)', 'error');
      return;
    }
    if (!gender) {
      showToast('აირჩიეთ სქესი (ბიჭი ან გოგო)', 'error');
      return;
    }
    if (!consentConfirmed) {
      showToast('გთხოვთ მონიშნოთ თანხმობის ველი', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await studentApiRequest<{ success: boolean; message: string }>('/submit', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          gender,
          photo,
          instagram: instagram.trim() || undefined,
          relationType,
          consentConfirmed: true,
        }),
      });

      showToast(res.message || 'ფოტო გაიგზავნა ადმინთან დასადასტურებლად!', 'success');
      resetForm();
      onSubmitted();
      onClose();
    } catch (err: any) {
      if (err?.code === 'BTU_AUTH_REQUIRED' || err?.status === 401) {
        onRequireAuth();
        return;
      }
      showToast(err.message || 'ატვირთვა ვერ მოხერხდა', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const consentText =
    relationType === 'SELF'
      ? 'ვადასტურებ, რომ ეს ჩემი ფოტოა და თანახმა ვარ მონაწილეობაზე'
      : 'ვადასტურებ, რომ ეს ჩემი მეგობრის ფოტოა და ის თანახმაა მონაწილეობაზე';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#12151D] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D8BE93]/15 border border-[#D8BE93]/30 flex items-center justify-center text-[#D8BE93]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white font-title">
                დაამატე ფოტო ბრძოლაში
              </h3>
              <p className="text-[11px] text-stone-400">
                ადმინის დადასტურებისთანავე გამოჩნდება არენაზე
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Relation Type Switcher: SELF vs FRIEND */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#0B0D12] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setRelationType('SELF');
                setConsentConfirmed(false);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                relationType === 'SELF'
                  ? 'bg-[#D8BE93] text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>ჩემი ფოტო</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRelationType('FRIEND');
                setConsentConfirmed(false);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                relationType === 'FRIEND'
                  ? 'bg-[#D8BE93] text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>მეგობრის ფოტო</span>
            </button>
          </div>

          {/* Photo Dropzone + Live Luxury Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const droppedFile = e.dataTransfer.files?.[0];
                handleFileSelected(droppedFile);
              }}
              className={`relative w-36 aspect-[3/4] rounded-2xl overflow-hidden flex-shrink-0 border-2 border-dashed transition cursor-pointer group ${
                isDragging
                  ? 'border-[#D8BE93] bg-[#D8BE93]/10'
                  : photo
                  ? 'border-[#D8BE93]/40 bg-[#0B0D12]'
                  : 'border-white/15 hover:border-[#D8BE93]/50 bg-[#0B0D12]'
              }`}
            >
              {photo ? (
                <>
                  <img
                    src={photo}
                    alt="Preview"
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="text-[11px] font-bold text-white truncate font-title">
                      {name || 'სახელი'}
                    </div>
                    {instagram && (
                      <div className="text-[9px] text-[#D8BE93] truncate">
                        @{instagram.replace(/^@/, '')}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white bg-black/70 px-2.5 py-1 rounded-full">
                      შეცვლა
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 gap-2">
                  {processingPhoto ? (
                    <RefreshCw className="w-6 h-6 text-[#D8BE93] animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-[#D8BE93]" />
                  )}
                  <span className="text-[11px] font-semibold text-stone-300 leading-tight">
                    {processingPhoto ? 'მუშავდება...' : 'ატვირთე ფოტო'}
                  </span>
                  <span className="text-[9px] text-stone-500">მაქს. 10 MB</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Right Inputs */}
            <div className="w-full flex-1 space-y-3">
              {/* Name */}
              <div>
                <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                  {relationType === 'SELF' ? 'შენი სახელი *' : 'მეგობრის სახელი *'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  placeholder={relationType === 'SELF' ? 'მაგ: ნინი ან ნინი ბერიძე' : 'მაგ: ლუკა'}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D12] border border-white/10 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-[#D8BE93]/60 transition"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                  სქესი *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('MALE')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      gender === 'MALE'
                        ? 'bg-[#D8BE93]/15 border-[#D8BE93] text-[#E8D3AD]'
                        : 'bg-[#0B0D12] border-white/10 text-stone-400 hover:border-white/25'
                    }`}
                  >
                    ბიჭი
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('FEMALE')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      gender === 'FEMALE'
                        ? 'bg-[#D8BE93]/15 border-[#D8BE93] text-[#E8D3AD]'
                        : 'bg-[#0B0D12] border-white/10 text-stone-400 hover:border-white/25'
                    }`}
                  >
                    გოგო
                  </button>
                </div>
              </div>

              {/* Optional Instagram */}
              <div>
                <label className="text-[11px] font-semibold text-stone-400 flex items-center gap-1.5 mb-1">
                  <Instagram className="w-3 h-3 text-[#D8BE93]" />
                  <span>Instagram (არასავალდებულო)</span>
                </label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  maxLength={40}
                  placeholder="@username"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D12] border border-white/10 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-[#D8BE93]/60 transition"
                />
              </div>
            </div>
          </div>

          {/* Consent Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] cursor-pointer select-none hover:border-[#D8BE93]/35 transition">
            <button
              type="button"
              role="checkbox"
              aria-checked={consentConfirmed}
              onClick={() => setConsentConfirmed((v) => !v)}
              className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition ${
                consentConfirmed
                  ? 'bg-[#D8BE93] border-[#D8BE93] text-stone-950'
                  : 'bg-[#0B0D12] border-white/20 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
            <span className="text-xs text-stone-300 leading-relaxed">{consentText}</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || processingPhoto || !photo || !name.trim() || !gender || !consentConfirmed}
            className="w-full py-3.5 rounded-2xl bg-[#D8BE93] hover:bg-[#C8A97E] disabled:opacity-45 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-[#D8BE93]/15"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>იგზავნება...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>გაგზავნა დასადასტურებლად</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

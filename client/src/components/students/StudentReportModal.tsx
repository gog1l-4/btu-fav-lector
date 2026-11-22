import React, { useState } from 'react';
import { Flag, RefreshCw, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { studentApiRequest } from '../../utils/studentAuth';

interface StudentReportModalProps {
  profile: { id: string; name: string } | null;
  onClose: () => void;
}

const REPORT_REASONS = [
  'ეს ჩემი ფოტოა — გთხოვთ წაშალოთ',
  'სხვისი ფოტოა ნებართვის გარეშე',
  'არასწორი ან უხარისხო ფოტო',
  'სხვა მიზეზი',
];

export function StudentReportModal({ profile, onClose }: StudentReportModalProps) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  if (!profile) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    try {
      setSubmitting(true);
      const res = await studentApiRequest<{ success: boolean; message: string }>(
        `/${profile.id}/report`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason,
            details: details.trim() || undefined,
          }),
        }
      );
      showToast(res.message || 'მოთხოვნა გაიგზავნა ადმინთან', 'success');
      setDetails('');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'გაგზავნა ვერ მოხერხდა', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#12151D] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-title">წაშლის მოთხოვნა / რეპორტი</h3>
              <p className="text-[11px] text-stone-400 truncate max-w-[220px]">{profile.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  reason === r
                    ? 'bg-rose-500/15 border-rose-400/50 text-white'
                    : 'bg-[#0B0D12] border-white/10 text-stone-400 hover:text-stone-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={350}
            rows={2}
            placeholder="დამატებითი კომენტარი (არასავალდებულო)..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D12] border border-white/10 text-white placeholder-stone-500 text-xs focus:outline-none focus:border-rose-400/50 transition resize-none"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
            <span>ადმინთან გაგზავნა</span>
          </button>
        </form>
      </div>
    </div>
  );
}

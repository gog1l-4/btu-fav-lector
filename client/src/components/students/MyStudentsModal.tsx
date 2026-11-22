import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  Download,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { MyStudentSubmission } from '../../types';
import { downloadDataUrl, generateStudentStoryImage } from '../../utils/storyGenerator';
import { clearStudentAuth, studentApiRequest } from '../../utils/studentAuth';

interface MyStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpload: () => void;
  onLoggedOut: () => void;
  onDeleted: () => void;
}

export function MyStudentsModal({
  isOpen,
  onClose,
  onOpenUpload,
  onLoggedOut,
  onDeleted,
}: MyStudentsModalProps) {
  const [email, setEmail] = useState<string>('');
  const [submissions, setSubmissions] = useState<MyStudentSubmission[]>([]);
  const [maxSubmissions, setMaxSubmissions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [storyLoadingId, setStoryLoadingId] = useState<string | null>(null);
  const { showToast } = useToast();

  async function loadMyData() {
    try {
      setLoading(true);
      const data = await studentApiRequest<{
        email: string;
        submissions: MyStudentSubmission[];
        maxSubmissions: number;
      }>('/auth/me');
      setEmail(data.email);
      setSubmissions(data.submissions || []);
      setMaxSubmissions(data.maxSubmissions || 5);
    } catch (err: any) {
      showToast(err.message || 'მონაცემების ჩატვირთვა ვერ მოხერხდა', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadMyData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleDelete(id: string) {
    if (!window.confirm('ნამდვილად გსურთ ამ ფოტოს წაშლა ბრძოლებიდან?')) return;
    try {
      setDeletingId(id);
      await studentApiRequest(`/my/${id}`, { method: 'DELETE' });
      setSubmissions((prev) => prev.filter((item) => item.id !== id));
      showToast('ფოტო წარმატებით წაიშალა', 'success');
      onDeleted();
    } catch (err: any) {
      showToast(err.message || 'წაშლა ვერ მოხერხდა', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownloadStory(item: MyStudentSubmission) {
    try {
      setStoryLoadingId(item.id);
      const dataUrl = await generateStudentStoryImage({
        name: item.name,
        photo: item.photo,
        instagram: item.instagram,
        rank: item.rank,
        winPercent: item.winPercent,
      });
      downloadDataUrl(dataUrl, `spaceuni-${item.name.replace(/\s+/g, '-')}.png`);
      showToast('Instagram Story ბარათი ჩამოიტვირთა! 🔥', 'success');
    } catch {
      showToast('სთორის შექმნა ვერ მოხერხდა', 'error');
    } finally {
      setStoryLoadingId(null);
    }
  }

  function handleLogout() {
    clearStudentAuth();
    showToast('ანგარიშიდან გამოხვედი', 'info');
    onLoggedOut();
    onClose();
  }

  const activeCount = submissions.filter((s) => s.status !== 'REJECTED').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#12151D] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#D8BE93]/15 border border-[#D8BE93]/30 flex items-center justify-center text-[#D8BE93] flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white font-title">
                ჩემი BTU ანგარიში
              </h3>
              <p className="text-[11px] text-[#D8BE93] truncate">{email || 'ვერიფიცირებული'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              title="გამოსვლა"
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-stone-400 hover:text-rose-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">გასვლა</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400">
              ატვირთული ფოტოები ({activeCount} / {maxSubmissions})
            </span>
            {activeCount < maxSubmissions && (
              <button
                onClick={() => {
                  onClose();
                  onOpenUpload();
                }}
                className="text-xs font-bold text-[#D8BE93] hover:text-[#E8D3AD] flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ახალი ფოტო</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-[#D8BE93] animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-8 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
              <p className="text-xs text-stone-400">
                ჯერ არცერთი ფოტო არ გაქვს ატვირთული — დაამატე შენი ან მეგობრის ფოტო!
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenUpload();
                }}
                className="px-4 py-2.5 rounded-full bg-[#D8BE93] hover:bg-[#C8A97E] text-stone-950 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ფოტოს დამატება</span>
              </button>
            </div>
          ) : (
            submissions.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-3"
              >
                <img
                  src={item.photo}
                  alt={item.name}
                  className="w-14 h-18 rounded-xl object-cover object-top border border-white/10 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-white truncate font-title">
                      {item.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-stone-400 border border-white/10">
                      {item.relationType === 'SELF' ? 'ჩემი' : 'მეგობრის'}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.status === 'APPROVED' && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>დადასტურებული</span>
                      </span>
                    )}
                    {item.status === 'PENDING' && (
                      <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>ელოდება ადმინს</span>
                      </span>
                    )}
                    {item.status === 'REJECTED' && (
                      <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        <span>უარყოფილი{item.rejectionReason ? `: ${item.rejectionReason}` : ''}</span>
                      </span>
                    )}

                    {item.status === 'APPROVED' && item.rank && (
                      <span className="text-[10px] font-bold text-[#D8BE93] flex items-center gap-0.5">
                        <Crown className="w-3 h-3" />
                        <span>#{item.rank} • {item.winPercent}%</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.status === 'APPROVED' && (
                    <button
                      onClick={() => handleDownloadStory(item)}
                      disabled={storyLoadingId === item.id}
                      title="Instagram Story ბარათის გადმოწერა"
                      className="p-2 rounded-xl bg-[#D8BE93]/15 hover:bg-[#D8BE93]/25 border border-[#D8BE93]/30 text-[#D8BE93] transition cursor-pointer"
                    >
                      {storyLoadingId === item.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="წაშლა"
                    className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-stone-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

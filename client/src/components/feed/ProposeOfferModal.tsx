import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { AcademicGroup, SwapListing } from '../../types';

interface ProposeOfferModalProps {
  listing: SwapListing | null;
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];

export function ProposeOfferModal({ listing, onClose, onSuccess }: ProposeOfferModalProps) {
  const { showToast } = useToast();
  const [groups, setGroups] = useState<AcademicGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [offeredGroupCode, setOfferedGroupCode] = useState('');
  const [offeredLecturerName, setOfferedLecturerName] = useState('');
  const [offeredDay, setOfferedDay] = useState('ორშაბათი');
  const [offeredTime, setOfferedTime] = useState('12:00');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!listing) return;
    setSelectedGroupId('');
    setOfferedGroupCode(listing.desiredGroupCode || '');
    setOfferedLecturerName(listing.desiredLecturerName || listing.currentLecturerName);
    setOfferedDay(listing.desiredDay || listing.currentDay);
    setOfferedTime(listing.desiredTime === 'ნებისმიერი' ? '12:00' : listing.desiredTime);
    setMessage('');

    apiRequest<{ groups: AcademicGroup[] }>(
      `/catalog/university/${listing.universityId}/academic`
    )
      .then((data) => {
        const courseGroups = data.groups.filter((g) => g.courseId === listing.courseId);
        setGroups(courseGroups);
      })
      .catch(() => setGroups([]));
  }, [listing]);

  if (!listing) return null;

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
    const g = groups.find((item) => item.id === groupId);
    if (g) {
      setOfferedGroupCode(g.groupCode);
      setOfferedLecturerName(g.lecturer?.fullName || '');
      setOfferedDay(g.dayOfWeek);
      setOfferedTime(g.startTime);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/offers', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.id,
          offeredGroupCode,
          offeredLecturerName,
          offeredDay,
          offeredTime,
          message,
        }),
      });
      showToast('გაცვლის შეთავაზება წარმატებით გაიგზავნა!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეცდომა შეთავაზების გაგზავნისას', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900">გაცვლის შეთავაზება</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {listing.course.name} — {listing.author.firstName} {listing.author.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {groups.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                სწრაფი არჩევა არსებული ჯგუფებიდან (არასავალდებულო)
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupSelect(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">აირჩიეთ თქვენი ჯგუფი...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.groupCode} · {g.dayOfWeek} {g.startTime} · {g.lecturer?.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                თქვენი ჯგუფის კოდი *
              </label>
              <input
                required
                value={offeredGroupCode}
                onChange={(e) => setOfferedGroupCode(e.target.value)}
                placeholder="მაგ: FE-01"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                თქვენი ლექტორი *
              </label>
              <input
                required
                value={offeredLecturerName}
                onChange={(e) => setOfferedLecturerName(e.target.value)}
                placeholder="მაგ: რევაზ მაკალათია"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ლექციის დღე *
              </label>
              <select
                value={offeredDay}
                onChange={(e) => setOfferedDay(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ლექციის დრო *
              </label>
              <input
                required
                value={offeredTime}
                onChange={(e) => setOfferedTime(e.target.value)}
                placeholder="მაგ: 12:00"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              შეტყობინება სტუდენტს (არასავალდებულო)
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="მაგ: გამარჯობა! სიამოვნებით გაგიცვლი 12:00-იან ჯგუფში..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
            გაითვალისწინეთ: შეთავაზების მიღება მხოლოდ გაკავშირებთ სტუდენტთან. ოფიციალური გაცვლა
            უნივერსიტეტის სისტემაში უნდა დასრულდეს.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm"
            >
              {submitting ? 'იგზავნება...' : 'შეთავაზების გაგზავნა'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

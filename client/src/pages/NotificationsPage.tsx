import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Mail, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { AppNotification } from '../types';
import { formatGeorgianRelativeDate } from '../utils/date';

export function NotificationsPage() {
  const { user, refreshMe, setCounts } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailOffers, setEmailOffers] = useState(user?.emailNotifyOffers ?? true);
  const [emailMessages, setEmailMessages] = useState(user?.emailNotifyMessages ?? false);
  const [pushEnabled, setPushEnabled] = useState(user?.pushNotifyEnabled ?? false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (user) {
      setEmailOffers(user.emailNotifyOffers);
      setEmailMessages(user.emailNotifyMessages);
      setPushEnabled(user.pushNotifyEnabled);
    }
  }, [user]);

  useEffect(() => {
    apiRequest<{ notifications: AppNotification[]; unreadCount: number }>('/notifications')
      .then((data) => {
        setNotifications(data.notifications);
        setCounts((prev) => ({ ...prev, unreadNotifications: data.unreadCount }));
      })
      .finally(() => setLoading(false));
  }, [setCounts]);

  const markAllRead = async () => {
    await apiRequest('/notifications/mark-all-read', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCounts((prev) => ({ ...prev, unreadNotifications: 0 }));
    showToast('ყველა შეტყობინება წაკითხულად მოინიშნა', 'success');
  };

  const handleOpen = async (n: AppNotification) => {
    if (!n.isRead) {
      await apiRequest(`/notifications/${n.id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setCounts((prev) => ({
        ...prev,
        unreadNotifications: Math.max(0, prev.unreadNotifications - 1),
      }));
    }
    if (n.linkUrl) navigate(n.linkUrl);
  };

  const savePreferences = async (next: {
    emailNotifyOffers?: boolean;
    emailNotifyMessages?: boolean;
    pushNotifyEnabled?: boolean;
  }) => {
    setSavingPrefs(true);
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(next),
      });
      await refreshMe();
      showToast('შეტყობინებების პარამეტრები შენახულია', 'success');
    } catch {
      showToast('შენახვა ვერ მოხერხდა', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-indigo-600" />
              შეტყობინებები
            </h1>
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
            >
              <CheckCheck className="w-4 h-4" />
              ყველა წაკითხულია
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card divide-y divide-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">იტვირთება...</div>
            ) : notifications.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                შეტყობინებების ისტორია ცარიელია
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={`w-full text-left p-4 sm:p-5 hover:bg-slate-50 transition flex items-start gap-3 ${
                    !n.isRead ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                      !n.isRead ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm text-slate-900">{n.title}</p>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatGeorgianRelativeDate(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">{n.body}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card space-y-4">
            <h2 className="font-bold text-base text-slate-900">შეტყობინებების პარამეტრები</h2>
            <p className="text-xs text-slate-500">
              აკონტროლეთ როგორ მიიღებთ სიახლეებს გაცვლის შეთავაზებებსა და შეტყობინებებზე
            </p>

            <div className="space-y-3 pt-2">
              <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 cursor-pointer">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">ელფოსტა შეთავაზებებზე</p>
                    <p className="text-[11px] text-slate-500">
                      ახალი შეთავაზების ან პასუხის მიღებისას
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={savingPrefs}
                  checked={emailOffers}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setEmailOffers(val);
                    savePreferences({ emailNotifyOffers: val });
                  }}
                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 cursor-pointer">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">ელფოსტა ჩატის მესიჯებზე</p>
                    <p className="text-[11px] text-slate-500">
                      პირადი შეტყობინების მიღებისას
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={savingPrefs}
                  checked={emailMessages}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setEmailMessages(val);
                    savePreferences({ emailNotifyMessages: val });
                  }}
                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 cursor-pointer">
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Browser Push შეტყობინებები
                    </p>
                    <p className="text-[11px] text-slate-500">
                      მალე დაემატება ბრაუზერის მყისიერი Push მხარდაჭერა
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={savingPrefs}
                  checked={pushEnabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setPushEnabled(val);
                    savePreferences({ pushNotifyEnabled: val });
                  }}
                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

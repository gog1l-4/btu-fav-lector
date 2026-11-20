import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  Bookmark,
  CheckCheck,
  GraduationCap,
  HelpCircle,
  Home,
  LogIn,
  MessageCircle,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import type { AppNotification } from '../../types';
import { Avatar } from '../common/Avatar';

interface AppLayoutProps {
  children: React.ReactNode;
  onFocusSearch?: () => void;
}

export function AppLayout({ children, onFocusSearch }: AppLayoutProps) {
  const { user, counts, setCounts } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);

  const loadNotifications = async () => {
    if (!user) return;
    setLoadingNotif(true);
    try {
      const data = await apiRequest<{ notifications: AppNotification[]; unreadCount: number }>(
        '/notifications'
      );
      setNotifications(data.notifications);
      setCounts((prev) => ({ ...prev, unreadNotifications: data.unreadCount }));
    } catch {
      // ignore
    } finally {
      setLoadingNotif(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handler = (notif: AppNotification) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 29)]);
    };
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket]);

  const toggleNotif = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) loadNotifications();
  };

  const markAllRead = async () => {
    await apiRequest('/notifications/mark-all-read', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCounts((prev) => ({ ...prev, unreadNotifications: 0 }));
  };

  const handleNotifClick = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await apiRequest(`/notifications/${notif.id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setCounts((prev) => ({
        ...prev,
        unreadNotifications: Math.max(0, prev.unreadNotifications - 1),
      }));
    }
    setNotifOpen(false);
    if (notif.linkUrl) navigate(notif.linkUrl);
  };

  const handleSearchClick = () => {
    if (onFocusSearch) {
      onFocusSearch();
    } else if (location.pathname !== '/feed' && location.pathname !== '/') {
      navigate('/feed?search=1');
    } else {
      navigate('/feed?search=1');
    }
  };

  const sidebarItems = [
    { to: user ? '/feed' : '/', label: 'Feed', icon: Home },
    { to: '/matches', label: 'Smart დამთხვევები', icon: Sparkles },
    {
      to: '/offers',
      label: 'ჩემი გაცვლები',
      icon: ArrowLeftRight,
      badge: counts.activeOffersCount > 0 ? counts.activeOffersCount : undefined,
    },
    {
      to: '/messages',
      label: 'შეტყობინებები',
      icon: MessageCircle,
      badge: counts.unreadMessages > 0 ? counts.unreadMessages : undefined,
    },
    { to: '/saved', label: 'შენახულები', icon: Bookmark },
    { to: '/profile', label: 'პროფილი', icon: UserIcon },
  ];

  if (user?.role === 'ADMIN') {
    sidebarItems.push({ to: '/admin', label: 'ადმინ პანელი', icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-[#F4F5F8] flex flex-col pb-20 lg:pb-6">
      {/* Clean Top Navbar (matches reference layout) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-[1340px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to={user ? '/feed' : '/'} className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-700 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              Swap<span className="text-violet-700">U</span>
            </span>
          </Link>

          {/* Center Horizontal Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            <NavLink
              to={user ? '/feed' : '/'}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  isActive || location.pathname === '/feed' || location.pathname === '/'
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Home className="w-4 h-4" />
              Feed
            </NavLink>

            <button
              onClick={handleSearchClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              <Search className="w-4 h-4" />
              ძიება
            </button>

            <Link
              to={user ? '/listings/new' : '/login'}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                location.pathname === '/listings/new'
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              განცხადების დამატება
            </Link>

            <Link
              to={user ? '/messages' : '/login'}
              className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                location.pathname === '/messages'
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              შეტყობინებები
              {user && counts.unreadMessages > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
                  {counts.unreadMessages}
                </span>
              )}
            </Link>
          </nav>

          {/* Right User / Auth Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {user ? (
              <>
                <div className="relative">
                  <button
                    onClick={toggleNotif}
                    className="relative p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                    title="შეტყობინებები"
                  >
                    <Bell className="w-5 h-5" />
                    {counts.unreadNotifications > 0 && (
                      <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {counts.unreadNotifications}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-40 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">შეტყობინებები</span>
                          <button
                            onClick={markAllRead}
                            className="text-xs font-semibold text-violet-700 hover:text-violet-800 inline-flex items-center gap-1"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            ყველა წაკითხულია
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                          {loadingNotif ? (
                            <div className="p-6 text-center text-sm text-slate-500">იტვირთება...</div>
                          ) : notifications.length === 0 ? (
                            <div className="p-6 text-center text-sm text-slate-500">
                              ახალი შეტყობინებები ჯერ არ არის
                            </div>
                          ) : (
                            notifications.slice(0, 8).map((n) => (
                              <button
                                key={n.id}
                                onClick={() => handleNotifClick(n)}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-start gap-3 ${
                                  !n.isRead ? 'bg-violet-50/40' : ''
                                }`}
                              >
                                <span
                                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                                    !n.isRead ? 'bg-violet-600' : 'bg-transparent'
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-900">{n.title}</p>
                                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                                    {n.body}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                        <Link
                          to="/notifications"
                          onClick={() => setNotifOpen(false)}
                          className="block text-center py-2.5 text-xs font-semibold text-violet-700 bg-slate-50 hover:bg-slate-100 border-t border-slate-100"
                        >
                          ყველა შეტყობინება და პარამეტრები
                        </Link>
                      </div>
                    </>
                  )}
                </div>

                <Link
                  to="/profile"
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition"
                >
                  <Avatar
                    firstName={user.firstName}
                    lastName={user.lastName}
                    avatarUrl={user.avatarUrl}
                    verificationStatus={user.studentVerificationStatus}
                    size="sm"
                  />
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  <LogIn className="w-4 h-4" />
                  შესვლა
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-bold shadow-sm transition"
                >
                  რეგისტრაცია
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1340px] w-full mx-auto px-4 sm:px-6 pt-5 flex-1 flex gap-6">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0">
          <div className="sticky top-20 space-y-4">
            <nav className="bg-white rounded-2xl border border-slate-200/80 p-2.5 shadow-card space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const targetTo = user ? item.to : item.to === '/' ? '/' : '/login';
                return (
                  <NavLink
                    key={item.to}
                    to={targetTo}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                        isActive
                          ? 'bg-violet-50 text-violet-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {user && item.badge !== undefined && (
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-rose-500 text-white font-bold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* University Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card flex items-center gap-3">
              <div className="px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-rose-600 to-violet-700 text-white font-extrabold text-xs tracking-wide shrink-0">
                {user?.university?.shortName || 'BTU'}
              </div>
              <p className="text-xs font-semibold text-slate-700 leading-snug">
                {user?.university?.name || 'ბიზნესისა და ტექნოლოგიების უნივერსიტეტი'}
              </p>
            </div>

            {/* Help / How It Works Card */}
            <button
              onClick={() => setHelpOpen(true)}
              className="w-full text-left rounded-2xl bg-violet-50/90 border border-violet-200/80 p-4 hover:bg-violet-100/70 transition flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-white text-violet-700 flex items-center justify-center shadow-xs shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">როგორ მუშაობს SwapU?</p>
                <p className="text-[11px] text-slate-600 mt-0.5">3 მარტივი ნაბიჯი სტუდენტებისთვის</p>
              </div>
            </button>
          </div>
        </aside>

        {/* Page Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around">
        <NavLink
          to={user ? '/feed' : '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-semibold ${
              isActive ? 'text-violet-700' : 'text-slate-500'
            }`
          }
        >
          <Home className="w-5 h-5" />
          მთავარი
        </NavLink>

        <button
          onClick={handleSearchClick}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-semibold text-slate-500"
        >
          <Search className="w-5 h-5" />
          ძიება
        </button>

        <Link
          to={user ? '/listings/new' : '/login'}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-semibold text-violet-700"
        >
          <PlusCircle className="w-5 h-5" />
          დამატება
        </Link>

        <NavLink
          to={user ? '/messages' : '/login'}
          className={({ isActive }) =>
            `relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-semibold ${
              isActive ? 'text-violet-700' : 'text-slate-500'
            }`
          }
        >
          <MessageCircle className="w-5 h-5" />
          {user && counts.unreadMessages > 0 && (
            <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {counts.unreadMessages}
            </span>
          )}
          შეტყობინებები
        </NavLink>

        <NavLink
          to={user ? '/profile' : '/login'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[11px] font-semibold ${
              isActive ? 'text-violet-700' : 'text-slate-500'
            }`
          }
        >
          <UserIcon className="w-5 h-5" />
          პროფილი
        </NavLink>
      </nav>

      {/* Simple 3-Step Guide Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900">როგორ მუშაობს SwapU?</h3>
              <button
                onClick={() => setHelpOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="font-bold text-violet-700">1. იპოვე ან გამოაქვეყნე განცხადება</p>
                <p className="text-xs text-slate-600 mt-1">
                  თითოეულ ბარათზე წითლად წერია <strong>რას თმობს</strong> სტუდენტი, ხოლო მწვანედ
                  — <strong>რას ეძებს</strong>.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="font-bold text-violet-700">2. გაუგზავნე შეთავაზება</p>
                <p className="text-xs text-slate-600 mt-1">
                  დააჭირე ღილაკს <strong>„შეთავაზება“</strong> და მიუთითე შენი ჯგუფის დრო.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="font-bold text-violet-700">3. შეთანხმდი ჩატში</p>
                <p className="text-xs text-slate-600 mt-1">
                  დადასტურების შემდეგ ჩატი ავტომატურად იხსნება, რომ უნივერსიტეტის პორტალში
                  გადაცვლაზე შეთანხმდეთ.
                </p>
              </div>
            </div>
            <button
              onClick={() => setHelpOpen(false)}
              className="w-full py-2.5 rounded-xl bg-violet-700 text-white text-sm font-bold"
            >
              გასაგებია
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

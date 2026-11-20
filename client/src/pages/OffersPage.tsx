import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  MessageCircle,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Avatar } from '../components/common/Avatar';
import { OfferStatusBadge } from '../components/common/StatusBadge';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { SwapOffer } from '../types';
import { formatGeorgianRelativeDate } from '../utils/date';

export function OffersPage() {
  const { user, refreshMe } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') === 'sent' ? 'sent' : 'received';

  const [offers, setOffers] = useState<SwapOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ offers: SwapOffer[] }>(`/offers?type=${activeTab}`);
      setOffers(data.offers);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'შეთავაზებების ჩატვირთვა ვერ მოხერხდა', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const handleAction = async (
    offerId: string,
    action: 'accept' | 'reject' | 'cancel' | 'complete',
    successMsg: string
  ) => {
    setBusyId(offerId);
    try {
      const res = await apiRequest<{ conversationId?: string }>(`/offers/${offerId}/${action}`, {
        method: 'POST',
      });
      showToast(successMsg, 'success');
      await Promise.all([loadOffers(), refreshMe()]);
      if (action === 'accept' && res.conversationId) {
        navigate(`/messages?conversationId=${res.conversationId}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'მოქმედება ვერ შესრულდა', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openChatWith = async (otherUserId: string, offerId: string) => {
    try {
      const data = await apiRequest<{ conversation: { id: string } }>(
        '/messages/conversations',
        {
          method: 'POST',
          body: JSON.stringify({ recipientId: otherUserId, offerId }),
        }
      );
      navigate(`/messages?conversationId=${data.conversation.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'ჩატის გახსნა ვერ მოხერხდა', 'error');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              გაცვლის შეთავაზებები
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              მართეთ შემოსული და გაგზავნილი გაცვლის მოთხოვნები
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1 shadow-card self-start">
            <button
              onClick={() => setParams({ tab: 'received' })}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'received'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              შემოსული
            </button>
            <button
              onClick={() => setParams({ tab: 'sent' })}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              გაგზავნილი
            </button>
          </div>
        </div>

        {/* Important Reminder */}
        <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            <strong>გაითვალისწინეთ:</strong> შეთავაზების მიღება SwapU-ზე ავტომატურად არ ცვლის
            უნივერსიტეტის ოფიციალურ ცხრილს. შეთანხმების შემდეგ მიწერეთ ერთმანეთს ჩატში და
            დაასრულეთ გაცვლა უნივერსიტეტის წესების მიხედვით, შემდეგ კი მონიშნეთ სტატუსი როგორც{' '}
            <strong>„დასრულებულია“</strong>.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 p-5 h-36 animate-pulse"
              />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
            <p className="font-bold text-slate-900">
              {activeTab === 'received'
                ? 'შემოსული შეთავაზებები ჯერ არ გაქვთ'
                : 'გაგზავნილი შეთავაზებები ჯერ არ გაქვთ'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'received'
                ? 'როგორც კი სხვა სტუდენტი გამოგზავნის შეთავაზებას თქვენს განცხადებაზე, აქ გამოჩნდება.'
                : 'იპოვეთ სასურველი განცხადება ფიდში და გაგზავნეთ გაცვლის შეთავაზება.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => {
              const isReceiver = offer.receiverId === user?.id;
              const partner = isReceiver ? offer.sender : offer.receiver;
              const isBusy = busyId === offer.id;

              return (
                <div
                  key={offer.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        firstName={partner.firstName}
                        lastName={partner.lastName}
                        avatarUrl={partner.avatarUrl}
                        verificationStatus={partner.studentVerificationStatus}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {partner.firstName} {partner.lastName}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {partner.university.shortName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {offer.listing.course.code} · {offer.listing.course.name} ·{' '}
                          {formatGeorgianRelativeDate(offer.createdAt)}
                        </p>
                      </div>
                    </div>

                    <OfferStatusBadge status={offer.status} />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5">
                      <p className="font-bold text-slate-500 uppercase text-[10px] mb-1">
                        განცხადების ჯგუფი ({offer.receiver.firstName})
                      </p>
                      <p className="font-bold text-slate-900">
                        {offer.listing.currentGroupCode} · {offer.listing.currentDay}{' '}
                        {offer.listing.currentTime}
                      </p>
                      <p className="text-slate-600 mt-0.5">{offer.listing.currentLecturerName}</p>
                    </div>

                    <div className="rounded-xl bg-indigo-50/60 border border-indigo-200/70 p-3.5">
                      <p className="font-bold text-indigo-600 uppercase text-[10px] mb-1">
                        შეთავაზებული ჯგუფი ({offer.sender.firstName})
                      </p>
                      <p className="font-bold text-indigo-900">
                        {offer.offeredGroupCode} · {offer.offeredDay} {offer.offeredTime}
                      </p>
                      <p className="text-slate-700 mt-0.5">{offer.offeredLecturerName}</p>
                    </div>
                  </div>

                  {offer.message && (
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-100">
                      „{offer.message}“
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openChatWith(partner.id, offer.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      მიმოწერა
                    </button>

                    {isReceiver && offer.status === 'PENDING' && (
                      <>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(offer.id, 'reject', 'შეთავაზება უარყოფილია')
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          უარყოფა
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(
                              offer.id,
                              'accept',
                              'შეთავაზება მიღებულია! გადადით ჩატში დეტალების შესათანხმებლად.'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          მიღება
                        </button>
                      </>
                    )}

                    {!isReceiver && offer.status === 'PENDING' && (
                      <button
                        disabled={isBusy}
                        onClick={() =>
                          handleAction(offer.id, 'cancel', 'შეთავაზება გაუქმდა')
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                      >
                        გაუქმება
                      </button>
                    )}

                    {offer.status === 'ACCEPTED' && (
                      <>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(
                              offer.id,
                              'cancel',
                              'შეთანხმება გაუქმდა და განცხადება კვლავ გაიხსნა'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold"
                        >
                          შეთანხმების გაუქმება
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(
                              offer.id,
                              'complete',
                              'გილოცავთ! გაცვლა მონიშნულია როგორც დასრულებული'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          დასრულებულად მონიშვნა
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import { Flag, Send, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { SwapListing } from '../../types';
import { formatGeorgianRelativeDate } from '../../utils/date';
import { Avatar } from '../common/Avatar';
import { ListingStatusBadge } from '../common/StatusBadge';

interface ListingDetailsModalProps {
  listing: SwapListing | null;
  onClose: () => void;
  onProposeOffer: (listing: SwapListing) => void;
  onReport: (listing: SwapListing) => void;
  onDelete?: (listingId: string) => void;
}

export function ListingDetailsModal({
  listing,
  onClose,
  onProposeOffer,
  onReport,
  onDelete,
}: ListingDetailsModalProps) {
  const { user } = useAuth();
  if (!listing) return null;

  const isOwner = user?.id === listing.authorId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-violet-50 text-violet-700">
              {listing.course.code}
            </span>
            <ListingStatusBadge status={listing.status} />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Avatar
              firstName={listing.author.firstName}
              lastName={listing.author.lastName}
              avatarUrl={listing.author.avatarUrl}
              verificationStatus={listing.author.studentVerificationStatus}
            />
            <div>
              <p className="font-bold text-sm text-slate-900">
                {listing.author.firstName} {listing.author.lastName}
              </p>
              <p className="text-xs text-slate-500">
                {listing.university.shortName} ·{' '}
                {listing.author.faculty?.name || 'სტუდენტი'} ·{' '}
                {formatGeorgianRelativeDate(listing.createdAt)}
              </p>
            </div>
          </div>

          <h3 className="font-extrabold text-lg text-slate-900">{listing.course.name}</h3>

          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl bg-rose-50/60 border border-rose-100 p-4 space-y-1">
              <p className="font-bold text-rose-700">რას თმობს (მიმდინარე)</p>
              <p className="font-bold text-slate-900 text-sm">
                {listing.currentGroupCode} · {listing.currentTime}
              </p>
              <p className="text-slate-700">{listing.currentDay}</p>
              <p className="text-slate-600">{listing.currentLecturerName}</p>
            </div>

            <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4 space-y-1">
              <p className="font-bold text-emerald-700">რას ეძებს (სასურველი)</p>
              <p className="font-bold text-slate-900 text-sm">
                {listing.desiredGroupCode || 'ნებისმიერი ჯგუფი'} · {listing.desiredTime}
              </p>
              <p className="text-slate-700">{listing.desiredDay || 'ნებისმიერი დღე'}</p>
              <p className="text-slate-600">
                {listing.desiredLecturerName || 'ნებისმიერი ლექტორი'}
              </p>
            </div>
          </div>

          {listing.comment && (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-700">
              {listing.comment}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {!isOwner && user && (
                <button
                  onClick={() => {
                    onClose();
                    onReport(listing);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Flag className="w-3.5 h-3.5" />
                  დარეპორტება
                </button>
              )}
              {isOwner && onDelete && listing.status === 'OPEN' && (
                <button
                  onClick={() => {
                    onDelete(listing.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  წაშლა
                </button>
              )}
            </div>

            {!isOwner && listing.status === 'OPEN' ? (
              <button
                onClick={() => {
                  onClose();
                  onProposeOffer(listing);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                გაცვლის შეთავაზება
              </button>
            ) : isOwner ? (
              <Link
                to="/offers?tab=received"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold"
              >
                შემოსული შეთავაზებები ({listing._count?.offers ?? 0})
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

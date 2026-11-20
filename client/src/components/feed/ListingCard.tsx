import { ArrowUpDown, Bookmark, Clock, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ListingStatus, SwapListing } from '../../types';
import { formatGeorgianRelativeDate } from '../../utils/date';
import { Avatar } from '../common/Avatar';

interface ListingCardProps {
  listing: SwapListing;
  onProposeOffer: (listing: SwapListing) => void;
  onOpenDetails: (listing: SwapListing) => void;
  onToggleSave: (listingId: string) => void;
}

const statusMeta: Record<ListingStatus, { label: string; dot: string; bg: string }> = {
  OPEN: {
    label: 'აქტიური',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 text-emerald-700',
  },
  MATCHED: {
    label: 'შეთანხმებული',
    dot: 'bg-violet-500',
    bg: 'bg-violet-50 text-violet-700',
  },
  COMPLETED: {
    label: 'დასრულებული',
    dot: 'bg-slate-400',
    bg: 'bg-slate-100 text-slate-600',
  },
  CANCELLED: {
    label: 'გაუქმებული',
    dot: 'bg-rose-400',
    bg: 'bg-rose-50 text-rose-700',
  },
};

export function ListingCard({
  listing,
  onProposeOffer,
  onOpenDetails,
  onToggleSave,
}: ListingCardProps) {
  const { user } = useAuth();
  const isOwner = user?.id === listing.authorId;
  const st = statusMeta[listing.status] || statusMeta.OPEN;

  return (
    <article className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-card hover:shadow-soft hover:border-violet-200 transition-all flex flex-col justify-between">
      <div>
        {/* Top Status + Bookmark */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${st.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>

          <button
            onClick={() => onToggleSave(listing.id)}
            className={`p-1.5 rounded-lg transition ${
              listing.isSaved
                ? 'text-violet-700 bg-violet-50'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={listing.isSaved ? 'შენახულებიდან წაშლა' : 'შენახვა'}
          >
            <Bookmark className={`w-4 h-4 ${listing.isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Student Header */}
        <div className="flex items-center gap-3 mt-3.5">
          <Link to={user ? `/profile/${listing.author.id}` : '/login'} className="shrink-0">
            <Avatar
              firstName={listing.author.firstName}
              lastName={listing.author.lastName}
              avatarUrl={listing.author.avatarUrl}
              verificationStatus={listing.author.studentVerificationStatus}
              size="md"
            />
          </Link>
          <div className="min-w-0">
            <Link
              to={user ? `/profile/${listing.author.id}` : '/login'}
              className="font-bold text-sm text-slate-900 hover:text-violet-700 transition block truncate"
            >
              {listing.author.firstName} {listing.author.lastName}
            </Link>
            <p className="text-[11px] text-slate-500 truncate">
              {listing.university.shortName}
              {listing.author.faculty?.name ? ` · ${listing.author.faculty.name}` : ''}
            </p>
          </div>
        </div>

        {/* What Student Gives Up (რას თმობს) */}
        <div className="mt-4 space-y-1">
          <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[11px] font-bold">
            რას თმობს
          </span>
          <h3 className="font-extrabold text-[15px] text-slate-900 leading-snug line-clamp-1">
            {listing.course.name}
          </h3>
          <p className="text-xs text-slate-600 truncate">
            {listing.currentLecturerName} ·{' '}
            <strong className="text-slate-800">{listing.currentTime}</strong>
            <span className="text-slate-400"> ({listing.currentGroupCode})</span>
          </p>
        </div>

        {/* Swap Divider */}
        <div className="my-3 flex items-center gap-2">
          <div className="h-px bg-slate-100 flex-1" />
          <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200/80 text-slate-500 flex items-center justify-center shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5" />
          </div>
          <div className="h-px bg-slate-100 flex-1" />
        </div>

        {/* What Student Wants (რას ეძებს) */}
        <div className="space-y-1">
          <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
            რას ეძებს
          </span>
          <p className="font-extrabold text-[15px] text-slate-900 leading-snug">
            {listing.desiredTime} ჯგუფი
            {listing.desiredDay ? ` · ${listing.desiredDay}` : ''}
          </p>
          <p className="text-xs text-slate-600 truncate">
            {listing.desiredLecturerName || 'სხვა ლექტორი ან დღის ჯგუფი'}
            {listing.desiredGroupCode ? ` (${listing.desiredGroupCode})` : ''}
          </p>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenDetails(listing)}
          className="flex items-center gap-3 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatGeorgianRelativeDate(listing.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {listing._count?.offers ?? 0}
          </span>
        </button>

        {!isOwner && listing.status === 'OPEN' ? (
          <button
            onClick={() => onProposeOffer(listing)}
            className="px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold shadow-xs transition"
          >
            შეთავაზება
          </button>
        ) : (
          <button
            onClick={() => onOpenDetails(listing)}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
          >
            დეტალები
          </button>
        )}
      </div>
    </article>
  );
}

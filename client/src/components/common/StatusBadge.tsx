import type { ListingStatus, OfferStatus } from '../../types';

const listingConfig: Record<ListingStatus, { label: string; className: string }> = {
  OPEN: { label: 'აქტიური', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MATCHED: { label: 'შეთანხმებული', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  COMPLETED: { label: 'დასრულებული', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CANCELLED: { label: 'გაუქმებული', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const offerConfig: Record<OfferStatus, { label: string; className: string }> = {
  PENDING: { label: 'მოლოდინში', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED: { label: 'მიღებულია', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  REJECTED: { label: 'უარყოფილია', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'გაუქმებულია', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  COMPLETED: { label: 'დასრულებულია', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const cfg = listingConfig[status] || listingConfig.OPEN;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const cfg = offerConfig[status] || offerConfig.PENDING;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

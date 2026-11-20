import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ListingCard } from '../components/feed/ListingCard';
import { ListingDetailsModal } from '../components/feed/ListingDetailsModal';
import { ProposeOfferModal } from '../components/feed/ProposeOfferModal';
import { ReportModal } from '../components/feed/ReportModal';
import { AppLayout } from '../components/layout/AppLayout';
import { useToast } from '../context/ToastContext';
import type { SwapListing } from '../types';

export function SavedPage() {
  const { showToast } = useToast();
  const [listings, setListings] = useState<SwapListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerListing, setOfferListing] = useState<SwapListing | null>(null);
  const [detailsListing, setDetailsListing] = useState<SwapListing | null>(null);
  const [reportListing, setReportListing] = useState<SwapListing | null>(null);

  const loadSaved = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ listings: SwapListing[] }>(
        '/listings?onlySaved=true&status=ALL'
      );
      setListings(data.listings);
    } catch {
      showToast('ჩატვირთვა ვერ მოხერხდა', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleToggleSave = async (listingId: string) => {
    await apiRequest(`/listings/${listingId}/save`, { method: 'POST' });
    setListings((prev) => prev.filter((l) => l.id !== listingId));
    showToast('განცხადება წაიშალა შენახულებიდან', 'info');
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-violet-700" />
            შენახული განცხადებები
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            აქ ინახება თქვენ მიერ მონიშნული საინტერესო გაცვლის განცხადებები
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            იტვირთება...
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
            <p className="font-bold text-slate-900">შენახული განცხადებები ჯერ არ გაქვთ</p>
            <p className="text-sm text-slate-500 mt-1">
              დააჭირეთ სანიშნეს (Bookmark) ნებისმიერ განცხადებაზე ფიდში.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                onProposeOffer={setOfferListing}
                onOpenDetails={setDetailsListing}
                onToggleSave={handleToggleSave}
              />
            ))}
          </div>
        )}
      </div>

      <ProposeOfferModal
        listing={offerListing}
        onClose={() => setOfferListing(null)}
        onSuccess={loadSaved}
      />
      <ListingDetailsModal
        listing={detailsListing}
        onClose={() => setDetailsListing(null)}
        onProposeOffer={setOfferListing}
        onReport={setReportListing}
      />
      <ReportModal listing={reportListing} onClose={() => setReportListing(null)} />
    </AppLayout>
  );
}

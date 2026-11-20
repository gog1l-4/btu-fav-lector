import { BadgeCheck } from 'lucide-react';
import type { VerificationStatus } from '../../types';

interface AvatarProps {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  verificationStatus?: VerificationStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({
  firstName,
  lastName,
  avatarUrl,
  verificationStatus,
  size = 'md',
}: AvatarProps) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const sizeClass =
    size === 'sm'
      ? 'w-9 h-9 text-xs'
      : size === 'lg'
        ? 'w-16 h-16 text-xl'
        : 'w-11 h-11 text-sm';

  return (
    <div className="relative inline-flex shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${firstName} ${lastName}`}
          className={`${sizeClass} rounded-full object-cover ring-2 ring-white bg-slate-100`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center ring-2 ring-white shadow-sm`}
        >
          {initials}
        </div>
      )}
      {verificationStatus === 'VERIFIED' && (
        <span
          title="ვერიფიცირებული სტუდენტი"
          className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm"
        >
          <BadgeCheck className="w-4 h-4 text-indigo-600" />
        </span>
      )}
    </div>
  );
}

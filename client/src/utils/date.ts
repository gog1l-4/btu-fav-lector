export function formatGeorgianRelativeDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ახლახანს';
  if (diffMin < 60) return `${diffMin} წუთის წინ`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} საათის წინ`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} დღის წინ`;
  return date.toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
}

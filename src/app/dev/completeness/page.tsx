import { notFound } from 'next/navigation';
import { SAVED_MANSIONS, type SavedMansion } from '@/lib/v3/parity/functionalMansions';
import { CompletenessViewer } from './viewer';

export default async function Page({ searchParams }: { searchParams: Promise<{ fixture?: string; variant?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { fixture, variant } = await searchParams;
  return <CompletenessViewer fixture={SAVED_MANSIONS.includes(fixture as SavedMansion) ? fixture as SavedMansion : 'f2149916'} variant={variant === 'saved' ? 'saved' : 'functional'} />;
}

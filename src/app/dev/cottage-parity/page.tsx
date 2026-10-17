import { notFound } from 'next/navigation';
import { PARITY_FIXTURES, type ParityFixtureName } from '@/lib/v3/parity/fixtures';
import { CottageParityViewer } from './viewer';

export default async function Page({ searchParams }: { searchParams: Promise<{ fixture?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { fixture } = await searchParams;
  return <CottageParityViewer fixture={fixture === 'mansion' ? 'mansion' : fixture && fixture in PARITY_FIXTURES ? fixture as ParityFixtureName : 'cottage'} />;
}

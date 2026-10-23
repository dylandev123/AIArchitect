import { notFound } from 'next/navigation';
import { conceptEvaluationEnabled } from '@/lib/v3/architecturalConcept';
import { compactMassingEnabled } from '@/lib/v3/compactMassing';
import { ArchitecturalConceptViewer } from './viewer';

export default function Page() {
  if (!conceptEvaluationEnabled()) notFound();
  return <ArchitecturalConceptViewer compactEnabled={compactMassingEnabled()} />;
}

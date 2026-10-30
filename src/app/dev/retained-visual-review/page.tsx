import { notFound } from 'next/navigation';
import { RetainedReviewCapture } from './viewer';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <RetainedReviewCapture />;
}

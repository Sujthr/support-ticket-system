import TicketDetailPage from './TicketDetailClient';

export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <TicketDetailPage />;
}

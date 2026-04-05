import AgentKpiPage from './AgentKpiClient';

export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <AgentKpiPage />;
}

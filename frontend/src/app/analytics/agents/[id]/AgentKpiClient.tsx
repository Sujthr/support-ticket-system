'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { analyticsApi } from '@/lib/api';
import { getInitials, getStatusColor, getPriorityColor, formatDate } from '@/lib/utils';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function AgentKpiPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.agentKpiDetail(params.id as string)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => { router.push('/analytics'); });
  }, [params.id]);

  if (loading || !data) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </AppLayout>
    );
  }

  const { agent, summary, weeklyResolved, resolutionTimes, recentTickets } = data;

  const kpiCards = [
    { label: 'Total Assigned', value: summary.totalAssigned, color: 'text-primary-600' },
    { label: 'Open Tickets', value: summary.openTickets, color: summary.openTickets > 10 ? 'text-red-600' : 'text-yellow-600' },
    { label: 'Resolved', value: summary.resolvedTickets, color: 'text-green-600' },
    { label: 'Resolution Rate', value: `${summary.resolutionRate}%`, color: summary.resolutionRate >= 70 ? 'text-green-600' : 'text-red-600' },
    { label: 'Avg Response Time', value: summary.avgFirstResponseHours != null ? `${summary.avgFirstResponseHours}h` : 'N/A', color: 'text-blue-600' },
    { label: 'Avg Resolution Time', value: summary.avgResolutionHours != null ? `${summary.avgResolutionHours}h` : 'N/A', color: 'text-blue-600' },
    { label: 'SLA Compliance', value: `${summary.slaComplianceRate}%`, color: summary.slaComplianceRate >= 90 ? 'text-green-600' : 'text-red-600' },
    { label: 'SLA Breaches', value: summary.slaBreachedCount, color: summary.slaBreachedCount > 0 ? 'text-red-600' : 'text-green-600' },
  ];

  const maxWeekly = Math.max(...weeklyResolved.map((w: any) => w.count), 1);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/analytics')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-300">
          {getInitials(agent.firstName, agent.lastName)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{agent.firstName} {agent.lastName}</h1>
          <p className="text-sm text-gray-500">{agent.email} &middot; Joined {formatDate(agent.createdAt)}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Resolved Chart */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Weekly Resolved Tickets (Last 12 Weeks)</h3>
          <div className="flex items-end gap-1 h-40">
            {weeklyResolved.map((w: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{w.count}</span>
                <div
                  className="w-full bg-primary-500 rounded-t-sm transition-all"
                  style={{ height: `${(w.count / maxWeekly) * 100}%`, minHeight: w.count > 0 ? '4px' : '1px' }}
                />
                <span className="text-[9px] text-gray-400 truncate w-full text-center">
                  {new Date(w.week).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution Times */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Resolution Times (Recent)</h3>
          {resolutionTimes.length === 0 ? (
            <p className="text-sm text-gray-500">No resolved tickets yet</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {resolutionTimes.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-8">#{r.ticketNumber}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${r.hours <= 4 ? 'bg-green-500' : r.hours <= 24 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min((r.hours / Math.max(...resolutionTimes.map((x: any) => x.hours), 1)) * 100, 100)}%`, minWidth: '8px' }}
                    />
                  </div>
                  <span className="text-xs font-medium w-12 text-right">{r.hours}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold">Recent Assigned Tickets</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SLA</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {recentTickets.map((t: any) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-sm text-gray-400">{t.ticketNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/tickets/${t.id}`} className="text-sm font-medium hover:text-primary-600">
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-3"><span className={`badge ${getStatusColor(t.status)}`}>{t.status}</span></td>
                <td className="px-4 py-3"><span className={`badge ${getPriorityColor(t.priority)}`}>{t.priority}</span></td>
                <td className="px-4 py-3">
                  {t.slaBreached ? (
                    <span className="badge bg-red-100 text-red-600">Breached</span>
                  ) : (
                    <span className="badge bg-green-100 text-green-600">OK</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

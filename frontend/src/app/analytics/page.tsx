'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { analyticsApi } from '@/lib/api';
import { DashboardStats } from '@/types';
import { getInitials } from '@/lib/utils';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [byPriority, setByPriority] = useState<{ priority: string; count: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [agentPerf, setAgentPerf] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard(),
      analyticsApi.byPriority(),
      analyticsApi.byStatus(),
      analyticsApi.agentPerformance(),
    ]).then(([statsRes, priorityRes, statusRes, perfRes]) => {
      setStats(statsRes.data);
      setByPriority(priorityRes.data);
      setByStatus(statusRes.data);
      setAgentPerf(perfRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const priorityColors: Record<string, string> = {
    LOW: 'bg-gray-400', MEDIUM: 'bg-blue-500', HIGH: 'bg-orange-500', URGENT: 'bg-red-500',
  };
  const statusColors: Record<string, string> = {
    OPEN: 'bg-green-500', PENDING: 'bg-yellow-500', RESOLVED: 'bg-blue-500', CLOSED: 'bg-gray-400',
  };

  const maxPriority = Math.max(...byPriority.map((p) => p.count), 1);
  const maxStatus = Math.max(...byStatus.map((s) => s.count), 1);

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total', value: stats.totalTickets },
                { label: 'Open', value: stats.openTickets },
                { label: 'Pending', value: stats.pendingTickets },
                { label: 'Resolved', value: stats.resolvedTickets },
                { label: 'SLA Breached', value: stats.slaBreached },
              ].map((s) => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Priority */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Tickets by Priority</h3>
              <div className="space-y-3">
                {byPriority.map((p) => (
                  <div key={p.priority} className="flex items-center gap-3">
                    <span className="text-sm w-16">{p.priority}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${priorityColors[p.priority] || 'bg-gray-400'} flex items-center justify-end pr-2`}
                        style={{ width: `${(p.count / maxPriority) * 100}%`, minWidth: p.count > 0 ? '2rem' : 0 }}
                      >
                        <span className="text-xs text-white font-medium">{p.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Status */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Tickets by Status</h3>
              <div className="space-y-3">
                {byStatus.map((s) => (
                  <div key={s.status} className="flex items-center gap-3">
                    <span className="text-sm w-20">{s.status}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${statusColors[s.status] || 'bg-gray-400'} flex items-center justify-end pr-2`}
                        style={{ width: `${(s.count / maxStatus) * 100}%`, minWidth: s.count > 0 ? '2rem' : 0 }}
                      >
                        <span className="text-xs text-white font-medium">{s.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Performance — Enhanced KPI Table */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold">Agent Performance KPIs</h3>
              <p className="text-sm text-gray-500 mt-1">Click an agent to view detailed metrics</p>
            </div>
            {agentPerf.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">No agent data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Assigned</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Open</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Resolved</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Resolution Rate</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Response</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Resolution</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">SLA Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {agentPerf.map((a: any) => (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/analytics/agents/${a.id}`} className="flex items-center gap-3 group">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-300">
                              {getInitials(a.name.split(' ')[0], a.name.split(' ')[1] || '')}
                            </div>
                            <div>
                              <p className="text-sm font-medium group-hover:text-primary-600">{a.name}</p>
                              <p className="text-xs text-gray-400">{a.email}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium">{a.totalAssigned}</td>
                        <td className="px-4 py-3 text-center text-sm">
                          <span className={a.openTickets > 5 ? 'text-orange-600 font-medium' : ''}>{a.openTickets}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{a.totalResolved}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-medium ${a.resolutionRate >= 70 ? 'text-green-600' : a.resolutionRate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {a.resolutionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {a.avgFirstResponseHours != null ? `${a.avgFirstResponseHours}h` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {a.avgResolutionHours != null ? `${a.avgResolutionHours}h` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`badge ${a.slaComplianceRate >= 90 ? 'bg-green-100 text-green-700' : a.slaComplianceRate >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {a.slaComplianceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

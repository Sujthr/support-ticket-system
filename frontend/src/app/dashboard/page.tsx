'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { analyticsApi, ticketsApi } from '@/lib/api';
import { DashboardStats, Ticket } from '@/types';
import { TicketIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { timeAgo, getPriorityColor, getStatusColor } from '@/lib/utils';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard().catch(() => ({ data: null })),
      ticketsApi.list({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: { data: [] } })),
    ]).then(([statsRes, ticketsRes]) => {
      if (statsRes.data) setStats(statsRes.data);
      setRecentTickets(ticketsRes.data.data || []);
      setLoading(false);
    });
  }, []);

  const statCards = stats
    ? [
        { label: 'Total Tickets', value: stats.totalTickets, icon: TicketIcon, color: 'text-primary-600 bg-primary-50' },
        { label: 'Open', value: stats.openTickets, icon: ClockIcon, color: 'text-green-600 bg-green-50' },
        { label: 'Resolved', value: stats.resolvedTickets, icon: CheckCircleIcon, color: 'text-blue-600 bg-blue-50' },
        { label: 'SLA Breached', value: stats.slaBreached, icon: ExclamationTriangleIcon, color: 'text-red-600 bg-red-50' },
      ]
    : [];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Overview of your support operations</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat) => (
              <div key={stat.label} className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent tickets */}
          <div className="card">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold">Recent Tickets</h2>
              <Link href="/tickets" className="text-sm text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {recentTickets.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No tickets yet</div>
              ) : (
                recentTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">#{ticket.ticketNumber}</span>
                        <h3 className="text-sm font-medium truncate">{ticket.title}</h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ticket.creator.firstName} {ticket.creator.lastName} &middot; {timeAgo(ticket.createdAt)}
                      </p>
                    </div>
                    <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                    <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

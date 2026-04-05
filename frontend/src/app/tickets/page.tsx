'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { ticketsApi, usersApi } from '@/lib/api';
import { Ticket, PaginatedResponse, User } from '@/types';
import { timeAgo, getPriorityColor, getStatusColor, getInitials, cn } from '@/lib/utils';
import { PlusIcon, FunnelIcon } from '@heroicons/react/24/outline';
import CreateTicketModal from '@/components/tickets/CreateTicketModal';

const statuses = ['', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
const priorities = ['', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TicketsPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div></AppLayout>}>
      <TicketsContent />
    </Suspense>
  );
}

function TicketsContent() {
  const searchParams = useSearchParams();
  const isMyView = searchParams.get('view') === 'my';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '', page: 1 });
  const [selected, setSelected] = useState<string[]>([]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: filters.page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.search) params.search = filters.search;

      const api = isMyView ? ticketsApi.myTickets : ticketsApi.list;
      const { data } = await api(params);
      setTickets(data.data);
      setMeta(data.meta);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filters, isMyView]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === tickets.length) {
      setSelected([]);
    } else {
      setSelected(tickets.map((t) => t.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selected.length === 0) return;
    try {
      await ticketsApi.bulkUpdate({ ticketIds: selected, status: action });
      setSelected([]);
      fetchTickets();
    } catch {}
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isMyView ? 'My Tickets' : 'All Tickets'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{meta.total} tickets total</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search tickets..."
            className="input max-w-xs"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
          <select
            className="input max-w-[160px]"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          >
            <option value="">All Statuses</option>
            {statuses.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="input max-w-[160px]"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value, page: 1 })}
          >
            <option value="">All Priorities</option>
            {priorities.filter(Boolean).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {selected.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-500">{selected.length} selected</span>
              <button onClick={() => handleBulkAction('RESOLVED')} className="btn-secondary text-sm py-1.5">
                Resolve
              </button>
              <button onClick={() => handleBulkAction('CLOSED')} className="btn-secondary text-sm py-1.5">
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ticket list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <p className="text-lg">No tickets found</p>
            <p className="text-sm mt-1">Create your first ticket to get started</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.length === tickets.length && tickets.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className={cn(
                      'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                      ticket.slaBreached && 'bg-red-50/50 dark:bg-red-900/10',
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(ticket.id)}
                        onChange={() => toggleSelect(ticket.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{ticket.ticketNumber}</td>
                    <td className="px-4 py-3">
                      <Link href={`/tickets/${ticket.id}`} className="text-sm font-medium hover:text-primary-600">
                        {ticket.title}
                      </Link>
                      {ticket.slaBreached && (
                        <span className="ml-2 badge bg-red-100 text-red-600 text-xs">SLA Breached</span>
                      )}
                      <div className="flex gap-1 mt-1">
                        {ticket.tags?.map((t) => (
                          <span key={t.tag.id} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            {t.tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      {ticket.assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-medium text-primary-700">
                            {getInitials(ticket.assignee.firstName, ticket.assignee.lastName)}
                          </div>
                          <span className="text-sm">{ticket.assignee.firstName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{timeAgo(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm text-gray-500">
                  Page {meta.page} of {meta.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page <= 1}
                    className="btn-secondary text-sm py-1.5"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page >= meta.totalPages}
                    className="btn-secondary text-sm py-1.5"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchTickets();
          }}
        />
      )}
    </AppLayout>
  );
}

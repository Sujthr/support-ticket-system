'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { ticketsApi, commentsApi, usersApi, jiraApi } from '@/lib/api';
import { Ticket, User } from '@/types';
import { useAuthStore } from '@/stores/auth';
import {
  timeAgo, formatDate, getPriorityColor, getStatusColor, getInitials, cn,
} from '@/lib/utils';
import {
  ArrowLeftIcon, PaperAirplaneIcon, LockClosedIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingJira, setCreatingJira] = useState(false);

  const isAgent = currentUser?.role === 'ADMIN' || currentUser?.role === 'AGENT';

  const fetchTicket = async () => {
    try {
      const { data } = await ticketsApi.get(params.id as string);
      setTicket(data);
    } catch {
      toast.error('Ticket not found');
      router.push('/tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    if (isAgent) {
      usersApi.agents().then((res) => setAgents(res.data)).catch(() => {});
    }
  }, [params.id]);

  const handleStatusChange = async (status: string) => {
    if (!ticket) return;
    try {
      await ticketsApi.update(ticket.id, { status });
      fetchTicket();
      toast.success(`Ticket ${status.toLowerCase()}`);
    } catch {}
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    if (!ticket) return;
    try {
      await ticketsApi.update(ticket.id, { assigneeId: assigneeId || undefined });
      fetchTicket();
    } catch {}
  };

  const handleCreateJiraIssue = async () => {
    if (!ticket || creatingJira) return;
    setCreatingJira(true);
    try {
      const { data } = await jiraApi.createIssue({ ticketId: ticket.id });
      toast.success(`JIRA issue ${data.jiraIssueKey} created!`);
      fetchTicket();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create JIRA issue');
    } finally {
      setCreatingJira(false);
    }
  };

  const handleSyncJira = async () => {
    if (!ticket) return;
    try {
      await jiraApi.syncStatus(ticket.id);
      fetchTicket();
      toast.success('JIRA status synced');
    } catch {
      toast.error('Failed to sync JIRA status');
    }
  };

  const handlePriorityChange = async (priority: string) => {
    if (!ticket) return;
    try {
      await ticketsApi.update(ticket.id, { priority });
      fetchTicket();
    } catch {}
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !ticket) return;
    setSubmitting(true);
    try {
      await commentsApi.create(ticket.id, { body: comment, isInternal });
      setComment('');
      setIsInternal(false);
      fetchTicket();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !ticket) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">#{ticket.ticketNumber}</span>
            <h1 className="text-xl font-bold">{ticket.title}</h1>
            {ticket.slaBreached && (
              <span className="badge bg-red-100 text-red-600">SLA Breached</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Created by {ticket.creator.firstName} {ticket.creator.lastName} &middot; {timeAgo(ticket.createdAt)}
          </p>
        </div>
        <span className={`badge text-sm ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
        <span className={`badge text-sm ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Comments / Conversation */}
          <div className="card">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold">Conversation</h3>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {ticket.comments?.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">No comments yet</div>
              )}
              {ticket.comments?.map((c) => (
                <div
                  key={c.id}
                  className={cn('p-4', c.isInternal && 'bg-yellow-50/50 dark:bg-yellow-900/10')}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-300 flex-shrink-0">
                      {getInitials(c.author.firstName, c.author.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.author.firstName} {c.author.lastName}</span>
                        <span className="text-xs text-gray-400">{c.author.role}</span>
                        {c.isInternal && (
                          <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                            <LockClosedIcon className="w-3 h-3" /> Internal note
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            <form onSubmit={handleComment} className="p-4 border-t border-gray-200 dark:border-gray-800">
              {isAgent && (
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={!isInternal}
                      onChange={() => setIsInternal(false)}
                      className="text-primary-600"
                    />
                    Public reply
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={isInternal}
                      onChange={() => setIsInternal(true)}
                      className="text-yellow-600"
                    />
                    <LockClosedIcon className="w-3.5 h-3.5 text-yellow-600" />
                    Internal note
                  </label>
                </div>
              )}
              <div className="flex gap-3">
                <textarea
                  className={cn(
                    'input flex-1 min-h-[80px]',
                    isInternal && 'border-yellow-400 dark:border-yellow-600',
                  )}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={isInternal ? 'Add an internal note...' : 'Reply to the customer...'}
                />
              </div>
              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors',
                    isInternal ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-primary-600 hover:bg-primary-700',
                  )}
                  disabled={submitting || !comment.trim()}
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  {submitting ? 'Sending...' : isInternal ? 'Add Note' : 'Reply'}
                </button>
              </div>
            </form>
          </div>

          {/* Activity Log */}
          {ticket.activityLogs && ticket.activityLogs.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Activity</h3>
              <div className="space-y-3">
                {ticket.activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <ClockIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{log.user.firstName} {log.user.lastName}</span>{' '}
                      <span className="text-gray-500">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                      {log.details && Object.entries(typeof log.details === 'string' ? JSON.parse(log.details) : log.details).map(([key, val]: [string, any]) => (
                        val?.from !== undefined ? (
                          <span key={key} className="text-gray-400"> ({key}: {String(val.from)} → {String(val.to)})</span>
                        ) : null
                      ))}
                      <span className="text-xs text-gray-400 ml-2">{timeAgo(log.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Properties */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold">Properties</h3>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              {isAgent ? (
                <select
                  className="input text-sm"
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="OPEN">Open</option>
                  <option value="PENDING">Pending</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              ) : (
                <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Priority</label>
              {isAgent ? (
                <select
                  className="input text-sm"
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              ) : (
                <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Assignee</label>
              {isAgent ? (
                <select
                  className="input text-sm"
                  value={ticket.assigneeId || ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm">
                  {ticket.assignee
                    ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                    : 'Unassigned'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1">
                {ticket.tags?.length ? (
                  ticket.tags.map((t) => (
                    <span key={t.tag.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      {t.tag.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">No tags</span>
                )}
              </div>
            </div>
          </div>

          {/* SLA Info */}
          {ticket.slaPolicy && (
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold">SLA Policy</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Response time</span>
                  <span>{ticket.slaPolicy.firstResponseMinutes}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolution time</span>
                  <span>{ticket.slaPolicy.resolutionMinutes}m</span>
                </div>
                {ticket.dueAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due</span>
                    <span className={ticket.slaBreached ? 'text-red-600 font-medium' : ''}>
                      {formatDate(ticket.dueAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* JIRA Integration */}
          {isAgent && (
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.004 0c-1.532 6.636-5.368 10.472-12.004 12.004 6.636 1.532 10.472 5.368 12.004 12.004 1.532-6.636 5.368-10.472 12.004-12.004-6.636-1.532-10.472-5.368-12.004-12.004z"/>
                </svg>
                JIRA
              </h3>
              {ticket.jiraIssueKey ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Issue</span>
                    <a
                      href={ticket.jiraIssueUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {ticket.jiraIssueKey}
                    </a>
                  </div>
                  {ticket.jiraStatus && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Status</span>
                      <span className="badge bg-blue-100 text-blue-700">{ticket.jiraStatus}</span>
                    </div>
                  )}
                  <button
                    onClick={handleSyncJira}
                    className="btn-secondary w-full text-sm py-1.5 mt-1"
                  >
                    Sync Status
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Create a dev ticket in JIRA for this support issue
                  </p>
                  <button
                    onClick={handleCreateJiraIssue}
                    disabled={creatingJira}
                    className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.004 0c-1.532 6.636-5.368 10.472-12.004 12.004 6.636 1.532 10.472 5.368 12.004 12.004 1.532-6.636 5.368-10.472 12.004-12.004-6.636-1.532-10.472-5.368-12.004-12.004z"/>
                    </svg>
                    {creatingJira ? 'Creating...' : 'Create JIRA Ticket'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold">Timeline</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{formatDate(ticket.createdAt)}</span>
              </div>
              {ticket.firstResponseAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">First response</span>
                  <span>{formatDate(ticket.firstResponseAt)}</span>
                </div>
              )}
              {ticket.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolved</span>
                  <span>{formatDate(ticket.resolvedAt)}</span>
                </div>
              )}
              {ticket.closedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Closed</span>
                  <span>{formatDate(ticket.closedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { ticketsApi, commentsApi, usersApi, jiraApi, categoriesApi, watchersApi, timeTrackingApi, csatApi, cannedResponsesApi } from '@/lib/api';
import { Ticket, User } from '@/types';
import { useAuthStore } from '@/stores/auth';
import {
  timeAgo, formatDate, getPriorityColor, getStatusColor, getInitials, cn,
} from '@/lib/utils';
import {
  ArrowLeftIcon, PaperAirplaneIcon, LockClosedIcon, ClockIcon,
  EyeIcon, EyeSlashIcon, StarIcon as StarOutlineIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
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

  // Category
  const [categories, setCategories] = useState<any[]>([]);

  // Watchers
  const [watchers, setWatchers] = useState<any[]>([]);
  const [watcherUserId, setWatcherUserId] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Time tracking
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  const [loggingTime, setLoggingTime] = useState(false);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);

  // CSAT
  const [csatRating, setCsatRating] = useState(0);
  const [csatFeedback, setCsatFeedback] = useState('');
  const [csatExisting, setCsatExisting] = useState<any>(null);
  const [submittingCsat, setSubmittingCsat] = useState(false);
  const [csatHover, setCsatHover] = useState(0);

  // Canned responses
  const [cannedResponses, setCannedResponses] = useState<any[]>([]);
  const [showCannedDropdown, setShowCannedDropdown] = useState(false);

  const isAgent = currentUser?.role === 'ADMIN' || currentUser?.role === 'AGENT';
  const isEndUser = currentUser?.role === 'END_USER';
  const isCreator = currentUser?.id === ticket?.creatorId;
  const isResolved = ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED';
  const isWatching = watchers.some((w: any) => w.userId === currentUser?.id || w.user?.id === currentUser?.id);

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

  const fetchWatchers = async () => {
    try {
      const { data } = await watchersApi.list(params.id as string);
      setWatchers(Array.isArray(data) ? data : data.data || []);
    } catch {}
  };

  const fetchTimeEntries = async () => {
    try {
      const { data } = await timeTrackingApi.list(params.id as string);
      setTimeEntries(Array.isArray(data) ? data : data.data || []);
    } catch {}
  };

  const fetchCsat = async () => {
    try {
      const { data } = await csatApi.get(params.id as string);
      if (data) setCsatExisting(data);
    } catch {}
  };

  useEffect(() => {
    fetchTicket();
    fetchWatchers();
    fetchTimeEntries();
    categoriesApi.list().then((res) => setCategories(Array.isArray(res.data) ? res.data : res.data.data || [])).catch(() => {});
    if (isAgent) {
      usersApi.agents().then((res) => setAgents(res.data)).catch(() => {});
      usersApi.list().then((res) => setAllUsers(Array.isArray(res.data) ? res.data : res.data.data || [])).catch(() => {});
      cannedResponsesApi.list().then((res) => setCannedResponses(Array.isArray(res.data) ? res.data : res.data.data || [])).catch(() => {});
    }
    fetchCsat();
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

  const handleCategoryChange = async (categoryId: string) => {
    if (!ticket) return;
    try {
      await ticketsApi.update(ticket.id, { categoryId: categoryId || null });
      fetchTicket();
      toast.success('Category updated');
    } catch {
      toast.error('Failed to update category');
    }
  };

  const handleWatchToggle = async () => {
    if (!ticket) return;
    try {
      if (isWatching) {
        await watchersApi.unwatchSelf(ticket.id);
        toast.success('Unwatched ticket');
      } else {
        await watchersApi.watchSelf(ticket.id);
        toast.success('Watching ticket');
      }
      fetchWatchers();
    } catch {
      toast.error('Failed to update watch status');
    }
  };

  const handleAddWatcher = async () => {
    if (!ticket || !watcherUserId) return;
    try {
      await watchersApi.add(ticket.id, watcherUserId);
      setWatcherUserId('');
      fetchWatchers();
      toast.success('Watcher added');
    } catch {
      toast.error('Failed to add watcher');
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !timeMinutes) return;
    setLoggingTime(true);
    try {
      await timeTrackingApi.log(ticket.id, {
        minutes: parseInt(timeMinutes),
        description: timeDescription || undefined,
      });
      setTimeMinutes('');
      setTimeDescription('');
      setShowTimeForm(false);
      fetchTicket();
      fetchTimeEntries();
      toast.success('Time logged');
    } catch {
      toast.error('Failed to log time');
    } finally {
      setLoggingTime(false);
    }
  };

  const handleCsatSubmit = async () => {
    if (!ticket || csatRating === 0) return;
    setSubmittingCsat(true);
    try {
      await csatApi.submit(ticket.id, { rating: csatRating, feedback: csatFeedback || undefined });
      toast.success('Thank you for your feedback!');
      fetchCsat();
    } catch {
      toast.error('Failed to submit rating');
    } finally {
      setSubmittingCsat(false);
    }
  };

  const insertCannedResponse = (content: string) => {
    setComment((prev) => (prev ? prev + '\n' + content : content));
    setShowCannedDropdown(false);
  };

  const formatTimeMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
        {ticket.source && ticket.source !== 'WEB' && ticket.source !== 'API' && (
          <span className={`badge text-sm ${
            ticket.source === 'PHONE' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
            ticket.source === 'WHATSAPP' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            ticket.source === 'EMAIL_INBOUND' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            'bg-gray-100 text-gray-600'
          }`}>
            {ticket.source === 'PHONE' ? 'Phone' : ticket.source === 'WHATSAPP' ? 'WhatsApp' : ticket.source === 'EMAIL_INBOUND' ? 'Inbound Email' : ticket.source}
          </span>
        )}
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
              {isAgent && cannedResponses.length > 0 && (
                <div className="relative mb-2">
                  <button
                    type="button"
                    onClick={() => setShowCannedDropdown(!showCannedDropdown)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    Insert template
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showCannedDropdown && (
                    <div className="absolute z-10 top-full left-0 mt-1 w-72 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      {cannedResponses.map((cr: any) => (
                        <button
                          key={cr.id}
                          type="button"
                          onClick={() => insertCannedResponse(cr.content)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <span className="text-sm font-medium block">{cr.title}</span>
                          {cr.shortcut && <span className="text-xs text-gray-400">/{cr.shortcut}</span>}
                          <p className="text-xs text-gray-500 truncate mt-0.5">{cr.content}</p>
                        </button>
                      ))}
                    </div>
                  )}
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
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              {isAgent ? (
                <select
                  className="input text-sm"
                  value={(ticket as any).categoryId || ''}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              ) : (
                (ticket as any).category ? (
                  <span
                    className="badge text-sm"
                    style={{ backgroundColor: (ticket as any).category.color + '20', color: (ticket as any).category.color }}
                  >
                    {(ticket as any).category.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">None</span>
                )
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

          {/* Watchers */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Watchers</h3>
              <button
                onClick={handleWatchToggle}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors',
                  isWatching
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                )}
              >
                {isWatching ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                {isWatching ? 'Unwatch' : 'Watch'}
              </button>
            </div>
            {watchers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {watchers.map((w: any) => {
                  const u = w.user || w;
                  return (
                    <div key={u.id || w.userId} className="flex items-center gap-1.5" title={`${u.firstName || ''} ${u.lastName || ''}`}>
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-[10px] font-medium text-primary-700 dark:text-primary-300">
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{u.firstName}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No watchers</p>
            )}
            {isAgent && (
              <div className="flex gap-2">
                <select
                  className="input text-sm flex-1"
                  value={watcherUserId}
                  onChange={(e) => setWatcherUserId(e.target.value)}
                >
                  <option value="">Add watcher...</option>
                  {allUsers
                    .filter((u) => !watchers.some((w: any) => (w.userId || w.user?.id) === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                </select>
                <button
                  onClick={handleAddWatcher}
                  disabled={!watcherUserId}
                  className="btn-primary py-1.5 px-2 text-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Time Tracking */}
          {isAgent && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Time Tracking</h3>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {formatTimeMinutes((ticket as any).totalTimeMinutes || 0)}
                </span>
              </div>
              {!showTimeForm ? (
                <button
                  onClick={() => setShowTimeForm(true)}
                  className="btn-secondary w-full text-sm py-1.5 flex items-center justify-center gap-2"
                >
                  <ClockIcon className="w-4 h-4" /> Log Time
                </button>
              ) : (
                <form onSubmit={handleLogTime} className="space-y-2">
                  <div>
                    <input
                      type="number"
                      className="input text-sm w-full"
                      placeholder="Minutes"
                      value={timeMinutes}
                      onChange={(e) => setTimeMinutes(e.target.value)}
                      min={1}
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="input text-sm w-full"
                      placeholder="Description (optional)"
                      value={timeDescription}
                      onChange={(e) => setTimeDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={loggingTime} className="btn-primary text-sm py-1.5 flex-1">
                      {loggingTime ? 'Logging...' : 'Log'}
                    </button>
                    <button type="button" onClick={() => setShowTimeForm(false)} className="btn-secondary text-sm py-1.5 flex-1">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {timeEntries.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {timeEntries.slice(0, 5).map((entry: any) => (
                    <div key={entry.id} className="text-xs flex justify-between items-start border-t border-gray-100 dark:border-gray-800 pt-1.5">
                      <div>
                        <span className="font-medium">{formatTimeMinutes(entry.minutes)}</span>
                        {entry.description && <p className="text-gray-500 mt-0.5">{entry.description}</p>}
                      </div>
                      <span className="text-gray-400 flex-shrink-0 ml-2">{timeAgo(entry.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CSAT Rating */}
          {isResolved && isEndUser && isCreator && (
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold">Rate your experience</h3>
              {csatExisting ? (
                <div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarSolidIcon
                        key={star}
                        className={cn('w-6 h-6', star <= (csatExisting.rating || csatExisting.score) ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-700')}
                      />
                    ))}
                  </div>
                  {csatExisting.feedback && (
                    <p className="text-sm text-gray-500 mt-2">{csatExisting.feedback}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Thank you for your feedback!</p>
                </div>
              ) : (
                <div>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setCsatHover(star)}
                        onMouseLeave={() => setCsatHover(0)}
                        onClick={() => setCsatRating(star)}
                        className="focus:outline-none"
                      >
                        {star <= (csatHover || csatRating) ? (
                          <StarSolidIcon className="w-7 h-7 text-yellow-400 transition-colors" />
                        ) : (
                          <StarOutlineIcon className="w-7 h-7 text-gray-300 dark:text-gray-600 transition-colors" />
                        )}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="input text-sm w-full min-h-[60px]"
                    placeholder="Any additional feedback? (optional)"
                    value={csatFeedback}
                    onChange={(e) => setCsatFeedback(e.target.value)}
                  />
                  <button
                    onClick={handleCsatSubmit}
                    disabled={csatRating === 0 || submittingCsat}
                    className="btn-primary w-full text-sm py-1.5 mt-2"
                  >
                    {submittingCsat ? 'Submitting...' : 'Submit Rating'}
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

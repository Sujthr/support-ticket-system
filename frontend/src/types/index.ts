export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'AGENT' | 'END_USER';
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  autoAssignMode?: string;
}

export interface TicketCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CustomPriority {
  id: string;
  name: string;
  level: number;
  color: string;
  icon?: string;
  isDefault: boolean;
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  priority: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  categoryId?: string;
  organizationId: string;
  creatorId: string;
  assigneeId?: string;
  slaBreached: boolean;
  dueAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  firstResponseAt?: string;
  totalTimeMinutes: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  jiraIssueKey?: string;
  jiraIssueUrl?: string;
  jiraStatus?: string;
  creator: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatar'>;
  assignee?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatar'>;
  category?: TicketCategory;
  tags: { tag: Tag }[];
  comments?: Comment[];
  attachments?: Attachment[];
  activityLogs?: ActivityLog[];
  watchers?: TicketWatcher[];
  satisfactionRating?: SatisfactionRating;
  timeEntries?: TimeEntry[];
  _count?: { comments: number; watchers: number };
  slaPolicy?: SlaPolicy;
}

export interface Comment {
  id: string;
  body: string;
  isInternal: boolean;
  ticketId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'avatar'>;
  attachments?: Attachment[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface SlaPolicy {
  id: string;
  name: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isActive: boolean;
}

export interface ActivityLog {
  id: string;
  action: string;
  details?: any;
  ticketId: string;
  userId: string;
  createdAt: string;
  user: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface TicketWatcher {
  ticketId: string;
  userId: string;
  addedAt: string;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatar'>;
}

export interface SatisfactionRating {
  id: string;
  rating: number;
  feedback?: string;
  ticketId: string;
  userId: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  minutes: number;
  description?: string;
  ticketId: string;
  userId: string;
  createdAt: string;
  user: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  shortcut?: string;
  categoryTag?: string;
  isShared: boolean;
  authorId: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: any;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  resolvedTickets: number;
  slaBreached: number;
}

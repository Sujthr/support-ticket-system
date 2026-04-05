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
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  organizationId: string;
  creatorId: string;
  assigneeId?: string;
  slaBreached: boolean;
  dueAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  firstResponseAt?: string;
  createdAt: string;
  updatedAt: string;
  jiraIssueKey?: string;
  jiraIssueUrl?: string;
  jiraStatus?: string;
  creator: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatar'>;
  assignee?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatar'>;
  tags: { tag: Tag }[];
  comments?: Comment[];
  attachments?: Attachment[];
  activityLogs?: ActivityLog[];
  _count?: { comments: number };
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

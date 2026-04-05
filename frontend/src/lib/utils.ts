import { formatDistanceToNow, format } from 'date-fns';

export function timeAgo(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

export function getPriorityColor(priority: string) {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    URGENT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  return colors[priority] || colors.MEDIUM;
}

export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    OPEN: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    RESOLVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  return colors[status] || colors.OPEN;
}

export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ticketsApi, usersApi } from '@/lib/api';
import { User } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTicketModal({ onClose, onCreated }: Props) {
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigneeId: '',
    tags: '',
  });

  useEffect(() => {
    usersApi.agents().then((res) => setAgents(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        priority: form.priority,
      };
      if (form.assigneeId) payload.assigneeId = form.assigneeId;
      if (form.tags.trim()) payload.tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);

      await ticketsApi.create(payload);
      toast.success('Ticket created');
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">New Ticket</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Brief summary of the issue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="input min-h-[120px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              placeholder="Detailed description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Assign To</label>
              <select
                className="input"
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <input
              type="text"
              className="input"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="bug, urgent, billing (comma separated)"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import {
  formatDueDateLabel,
  PRIORITY_VALUES,
  TASK_NOTES_MAX,
  TASK_TITLE_MAX,
  validateTaskDraft,
  type TaskDraft,
  type TaskItem,
  type TaskPriority,
} from '../lib/validation';

interface TaskRowProps {
  task: TaskItem;
  availableLists: string[];
  onToggle: (task: TaskItem) => Promise<void>;
  onUpdate: (taskId: string, draft: TaskDraft) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

const PRIORITY_LABELS: Record<TaskPriority, { label: string; className: string }> = {
  high: {
    label: 'High priority',
    className: 'text-red-600 dark:text-red-400 font-medium',
  },
  medium: {
    label: 'Medium priority',
    className: 'text-amber-600 dark:text-amber-400 font-medium',
  },
  low: {
    label: 'Low priority',
    className: 'text-slate-500 dark:text-slate-400',
  },
};

export function TaskRow({
  task,
  availableLists,
  onToggle,
  onUpdate,
  onDelete,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [listName, setListName] = useState(task.listName);
  const [dueDate, setDueDate] = useState(task.dueDate);

  const dueInfo = formatDueDateLabel(task.dueDate);
  const priorityMeta = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.medium;

  const startEditing = () => {
    setTitle(task.title);
    setNotes(task.notes);
    setPriority(task.priority);
    setListName(task.listName);
    setDueDate(task.dueDate);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleToggle = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await onToggle(task);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await onDelete(task.id);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    const validation = validateTaskDraft({
      title,
      notes,
      priority,
      listName,
      dueDate,
    });
    if (!validation.valid) {
      setEditError(validation.error);
      return;
    }

    setIsBusy(true);
    setEditError(null);
    try {
      await onUpdate(task.id, validation.sanitized);
      setIsEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save task.');
    } finally {
      setIsBusy(false);
    }
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleSaveEdit}
        className="px-4 py-4 bg-slate-50/70 dark:bg-slate-800/40"
      >
        <div className="space-y-3">
          <div>
            <label htmlFor={`edit-title-${task.id}`} className="sr-only">
              Task title
            </label>
            <input
              id={`edit-title-${task.id}`}
              type="text"
              value={title}
              maxLength={TASK_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  cancelEditing();
                }
              }}
              placeholder="Task title"
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={`edit-notes-${task.id}`} className="sr-only">
              Notes
            </label>
            <textarea
              id={`edit-notes-${task.id}`}
              rows={2}
              value={notes}
              maxLength={TASK_NOTES_MAX}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Task list"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableLists.map((list) => (
                <option key={list} value={list}>
                  {list}
                </option>
              ))}
            </select>

            <select
              aria-label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITY_VALUES.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)} priority
                </option>
              ))}
            </select>

            <input
              type="date"
              aria-label="Due date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <span>{isBusy ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>

          {editError && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {editError}
            </p>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="group px-4 py-3 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
      {/* 40px accessible toggle hit target */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        aria-label={task.completed ? `Mark "${task.title}" as active` : `Mark "${task.title}" as completed`}
        aria-pressed={task.completed}
        className="w-10 h-10 -ml-2 -my-1.5 flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 cursor-pointer"
      >
        <span
          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
            task.completed
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-blue-500'
          }`}
        >
          {task.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />}
        </span>
      </button>

      {/* Main Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-baseline justify-between gap-4">
          <p
            className={`text-sm leading-snug break-words ${
              task.completed
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-900 dark:text-slate-100 font-medium'
            }`}
          >
            {task.title}
          </p>
        </div>

        {task.notes && (
          <p
            className={`mt-1 text-xs leading-relaxed break-words ${
              task.completed
                ? 'text-slate-400 dark:text-slate-600'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {task.notes}
          </p>
        )}

        {/* Unboxed Zero-Pill Inline Metadata */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{task.listName}</span>
          <span aria-hidden="true">·</span>
          <span className={task.completed ? 'text-slate-400 dark:text-slate-500' : priorityMeta.className}>
            {priorityMeta.label}
          </span>
          {dueInfo && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={`font-mono ${
                  task.completed
                    ? 'text-slate-400 dark:text-slate-500'
                    : dueInfo.tone === 'overdue'
                      ? 'text-red-600 dark:text-red-400 font-medium'
                      : dueInfo.tone === 'today'
                        ? 'text-amber-600 dark:text-amber-400 font-medium'
                        : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {dueInfo.text}
              </span>
            </>
          )}
          {task.completed && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed</span>
            </>
          )}
        </div>
      </div>

      {/* Row Actions */}
      <div className="flex items-center gap-1 shrink-0 -mr-1.5">
        <button
          type="button"
          onClick={startEditing}
          disabled={isBusy}
          aria-label={`Edit "${task.title}"`}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isBusy}
          aria-label={`Delete "${task.title}"`}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

import type { User } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

// Constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const OWNER_ID_MIN = 1;
export const OWNER_ID_MAX = 128;
export const OWNER_ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

export const TASK_TITLE_MIN = 1;
export const TASK_TITLE_MAX = 160;

export const TASK_NOTES_MIN = 0;
export const TASK_NOTES_MAX = 1000;

export const LIST_NAME_MIN = 1;
export const LIST_NAME_MAX = 40;
export const LIST_NAME_PATTERN = /^[a-zA-Z0-9 _\-&]+$/;

export const DUE_DATE_MAX = 10;
export const DUE_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})?$/;

export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 80;

export const CUSTOM_LISTS_MAX = 10;
export const DEFAULT_LISTS = ['Inbox', 'Work', 'Personal', 'Errands'] as const;

export const PRIORITY_VALUES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof PRIORITY_VALUES)[number];

export interface TaskItem {
  id: string;
  ownerId: string;
  title: string;
  notes: string;
  completed: boolean;
  priority: TaskPriority;
  listName: string;
  dueDate: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserWorkspace {
  uid: string;
  displayName: string;
  customLists: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TaskDraft {
  title: string;
  notes: string;
  priority: TaskPriority;
  listName: string;
  dueDate: string;
}

export function normalizeDisplayName(user: User): string {
  const raw = (user.displayName || user.email?.split('@')[0] || 'Workspace User').trim();
  const sliced = raw.slice(0, DISPLAY_NAME_MAX).trim();
  return sliced.length >= DISPLAY_NAME_MIN ? sliced : 'Workspace User';
}

export function sanitizeListName(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, LIST_NAME_MAX);
}

export function validateListName(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < LIST_NAME_MIN) {
    return 'List name cannot be empty.';
  }
  if (trimmed.length > LIST_NAME_MAX) {
    return `List name must be ${LIST_NAME_MAX} characters or fewer.`;
  }
  if (!LIST_NAME_PATTERN.test(trimmed)) {
    return 'Use letters, numbers, spaces, hyphens, underscores, or & only.';
  }
  return null;
}

export function validateTaskDraft(draft: TaskDraft): { valid: boolean; error: string | null; sanitized: TaskDraft } {
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  const listName = sanitizeListName(draft.listName) || 'Inbox';
  const dueDate = draft.dueDate.trim();
  const priority: TaskPriority = PRIORITY_VALUES.includes(draft.priority) ? draft.priority : 'medium';

  if (title.length < TASK_TITLE_MIN) {
    return { valid: false, error: 'Please enter a task title.', sanitized: draft };
  }
  if (title.length > TASK_TITLE_MAX) {
    return { valid: false, error: `Task title must be ${TASK_TITLE_MAX} characters or fewer.`, sanitized: draft };
  }
  if (notes.length > TASK_NOTES_MAX) {
    return { valid: false, error: `Notes must be ${TASK_NOTES_MAX} characters or fewer.`, sanitized: draft };
  }
  if (listName.length < LIST_NAME_MIN || listName.length > LIST_NAME_MAX || !LIST_NAME_PATTERN.test(listName)) {
    return { valid: false, error: 'List name contains invalid characters.', sanitized: draft };
  }
  if (dueDate.length > DUE_DATE_MAX || !DUE_DATE_PATTERN.test(dueDate)) {
    return { valid: false, error: 'Due date must use YYYY-MM-DD format.', sanitized: draft };
  }

  return {
    valid: true,
    error: null,
    sanitized: {
      title,
      notes,
      priority,
      listName,
      dueDate,
    },
  };
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDueDateLabel(dueDate: string): { text: string; tone: 'overdue' | 'today' | 'upcoming' } | null {
  if (!dueDate) {
    return null;
  }
  const today = getTodayIsoDate();
  const [y, m, d] = dueDate.split('-').map(Number);
  const parsed = new Date(y, (m || 1) - 1, d || 1);
  const formatted = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (dueDate < today) {
    return { text: `Overdue · ${formatted}`, tone: 'overdue' };
  }
  if (dueDate === today) {
    return { text: 'Due today', tone: 'today' };
  }
  return { text: `Due ${formatted}`, tone: 'upcoming' };
}

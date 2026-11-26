import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  CalendarClock,
  CheckCircle2,
  Folder,
  Inbox,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from 'lucide-react';
import {
  CUSTOM_LISTS_MAX,
  DEFAULT_LISTS,
  getTodayIsoDate,
  LIST_NAME_MAX,
  PRIORITY_VALUES,
  TASK_NOTES_MAX,
  TASK_TITLE_MAX,
  validateListName,
  validateTaskDraft,
  type TaskDraft,
  type TaskItem,
  type TaskPriority,
} from '../lib/validation';
import { TaskRow } from './TaskRow';

type SmartView = 'all' | 'active' | 'completed' | 'today';
type StatusFilter = 'all' | 'active' | 'completed';
type SortOption = 'newest' | 'dueDate' | 'priority' | 'title';

export interface SyncStatus {
  hasPendingWrites: boolean;
  fromCache: boolean;
}

interface WorkspaceViewProps {
  user: User;
  tasks: TaskItem[];
  customLists: string[];
  loading: boolean;
  syncStatus: SyncStatus;
  actionError: string | null;
  onDismissError: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignOut: () => Promise<void>;
  onAddTask: (draft: TaskDraft) => Promise<void>;
  onToggleTask: (task: TaskItem) => Promise<void>;
  onUpdateTask: (taskId: string, draft: TaskDraft) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onClearCompleted: (completedTasks: TaskItem[]) => Promise<void>;
  onAddCustomList: (name: string) => Promise<void>;
  onRemoveCustomList: (name: string) => Promise<void>;
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function WorkspaceView({
  user,
  tasks,
  customLists,
  loading,
  syncStatus,
  actionError,
  onDismissError,
  isDark,
  onToggleTheme,
  onSignOut,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onClearCompleted,
  onAddCustomList,
  onRemoveCustomList,
}: WorkspaceViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<SmartView>('all');
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer state
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newListName, setNewListName] = useState<string>('Inbox');
  const [newDueDate, setNewDueDate] = useState('');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Custom list creation state
  const [isAddingList, setIsAddingList] = useState(false);
  const [newCustomListInput, setNewCustomListInput] = useState('');
  const [customListError, setCustomListError] = useState<string | null>(null);
  const [isSavingList, setIsSavingList] = useState(false);

  // Avatar fallback
  const [avatarFailed, setAvatarFailed] = useState(false);

  const availableLists = useMemo(() => {
    const merged = customLists.length > 0 ? customLists : [...DEFAULT_LISTS];
    const fromTasks = tasks.map((t) => t.listName);
    return Array.from(new Set([...merged, ...fromTasks]));
  }, [customLists, tasks]);

  const sidebarLists = useMemo(() => {
    return customLists.length > 0 ? customLists : [...DEFAULT_LISTS];
  }, [customLists]);

  const todayIso = getTodayIsoDate();

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let today = 0;
    const byList: Record<string, number> = {};

    for (const task of tasks) {
      if (task.completed) {
        completed += 1;
      } else {
        active += 1;
        byList[task.listName] = (byList[task.listName] || 0) + 1;
        if (task.dueDate && task.dueDate <= todayIso) {
          today += 1;
        }
      }
    }

    return {
      all: tasks.length,
      active,
      completed,
      today,
      byList,
    };
  }, [tasks, todayIso]);

  const visibleTasks = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();

    const filtered = tasks.filter((task) => {
      if (selectedList !== null && task.listName !== selectedList) {
        return false;
      }
      if (selectedList === null) {
        if (selectedView === 'active' && task.completed) return false;
        if (selectedView === 'completed' && !task.completed) return false;
        if (selectedView === 'today' && (task.completed || !task.dueDate || task.dueDate > todayIso)) {
          return false;
        }
      }
      if (statusFilter === 'active' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;

      if (queryLower) {
        const hay = `${task.title} ${task.notes} ${task.listName}`.toLowerCase();
        if (!hay.includes(queryLower)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pDiff !== 0) return pDiff;
      } else if (sortBy === 'dueDate') {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate && b.dueDate) {
          if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        } else if (a.dueDate) {
          return -1;
        } else if (b.dueDate) {
          return 1;
        }
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }

      // Default / tie-breaker: newest first (pending serverTimestamp treated as newest)
      const aMs = a.createdAt ? a.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
      const bMs = b.createdAt ? b.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
      return bMs - aMs;
    });
  }, [tasks, selectedList, selectedView, statusFilter, searchQuery, sortBy, todayIso]);

  const completedInView = useMemo(
    () => visibleTasks.filter((task) => task.completed),
    [visibleTasks],
  );

  const activeBreadcrumb = useMemo(() => {
    if (selectedList) return selectedList;
    if (selectedView === 'active') return 'Active';
    if (selectedView === 'completed') return 'Completed';
    if (selectedView === 'today') return 'Due Today & Overdue';
    return 'All Tasks';
  }, [selectedList, selectedView]);

  const handleSelectSmartView = (view: SmartView) => {
    setSelectedView(view);
    setSelectedList(null);
    setStatusFilter('all');
    setSidebarOpen(false);
  };

  const handleSelectList = (list: string) => {
    setSelectedList(list);
    setNewListName(list);
    setStatusFilter('all');
    setSidebarOpen(false);
  };

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    const targetList = selectedList || newListName || 'Inbox';
    const validation = validateTaskDraft({
      title: newTitle,
      notes: newNotes,
      priority: newPriority,
      listName: targetList,
      dueDate: newDueDate,
    });

    if (!validation.valid) {
      setComposerError(validation.error);
      return;
    }

    setIsAddingTask(true);
    setComposerError(null);
    try {
      await onAddTask(validation.sanitized);
      setNewTitle('');
      setNewNotes('');
      setNewDueDate('');
      setNewPriority('medium');
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Unable to add task.');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleCreateCustomList = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateListName(newCustomListInput);
    if (err) {
      setCustomListError(err);
      return;
    }
    const clean = newCustomListInput.trim().replace(/\s+/g, ' ');
    if (sidebarLists.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      setCustomListError('That list already exists.');
      return;
    }
    if (sidebarLists.length >= CUSTOM_LISTS_MAX) {
      setCustomListError(`Maximum of ${CUSTOM_LISTS_MAX} lists reached.`);
      return;
    }

    setIsSavingList(true);
    setCustomListError(null);
    try {
      await onAddCustomList(clean);
      setNewCustomListInput('');
      setIsAddingList(false);
      setSelectedList(clean);
      setNewListName(clean);
    } catch (error) {
      setCustomListError(error instanceof Error ? error.message : 'Could not add list.');
    } finally {
      setIsSavingList(false);
    }
  };

  const userInitials = useMemo(() => {
    const source = user.displayName || user.email || 'U';
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }, [user.displayName, user.email]);

  const syncLabel = syncStatus.hasPendingWrites
    ? 'Syncing changes...'
    : syncStatus.fromCache
      ? 'Offline cache'
      : 'Live sync active';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand Wordmark */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
          Clearlist
        </span>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="px-3 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Views
          </p>
          <nav className="space-y-0.5" aria-label="Task views">
            <button
              type="button"
              onClick={() => handleSelectSmartView('all')}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                selectedList === null && selectedView === 'all'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Inbox className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span className="truncate">All Tasks</span>
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSmartView('active')}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                selectedList === null && selectedView === 'active'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <ListTodo className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span className="truncate">Active</span>
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {counts.active}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSmartView('today')}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                selectedList === null && selectedView === 'today'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <CalendarClock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span className="truncate">Due Today</span>
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {counts.today}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSmartView('completed')}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                selectedList === null && selectedView === 'completed'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="truncate">Completed</span>
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {counts.completed}
              </span>
            </button>
          </nav>
        </div>

        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Lists</p>
            {sidebarLists.length < CUSTOM_LISTS_MAX && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingList((prev) => !prev);
                  setCustomListError(null);
                }}
                aria-label="Add new list"
                className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {isAddingList && (
            <form onSubmit={handleCreateCustomList} className="px-2 mb-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCustomListInput}
                  maxLength={LIST_NAME_MAX}
                  onChange={(e) => setNewCustomListInput(e.target.value)}
                  placeholder="List name..."
                  autoFocus
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSavingList}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  Add
                </button>
              </div>
              {customListError && (
                <p className="text-xs text-red-600 dark:text-red-400 px-1">{customListError}</p>
              )}
            </form>
          )}

          <nav className="space-y-0.5" aria-label="Task lists">
            {sidebarLists.map((list) => {
              const isSelected = selectedList === list;
              const isDefault = (DEFAULT_LISTS as readonly string[]).includes(list);
              return (
                <div key={list} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSelectList(list)}
                    className={`flex-1 min-w-0 flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Folder className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">{list}</span>
                    </span>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 pl-2">
                      {counts.byList[list] || 0}
                    </span>
                  </button>
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedList === list) {
                          setSelectedList(null);
                        }
                        onRemoveCustomList(list);
                      }}
                      aria-label={`Remove list ${list}`}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 ml-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer: Live Firestore Sync State & Controls */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus.hasPendingWrites
                  ? 'bg-amber-500'
                  : syncStatus.fromCache
                    ? 'bg-slate-400'
                    : 'bg-emerald-500'
              }`}
              aria-hidden="true"
            />
            <span>{syncLabel}</span>
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden w-10 h-10 -ml-2 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-slate-500 dark:text-slate-400 hidden sm:inline whitespace-nowrap">
                  Workspace
                </span>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {activeBreadcrumb}
                </h1>
              </div>
            </div>

            {/* Search + User Profile */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative w-44 sm:w-64">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900"
                />
              </div>

              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                {user.photoURL && !avatarFailed ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Account avatar'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-semibold">
                    {userInitials}
                  </div>
                )}
                <div className="hidden md:block text-left max-w-[140px]">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {user.displayName || 'Workspace User'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace Content */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {actionError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 flex items-center justify-between gap-4 text-sm text-red-700 dark:text-red-300"
            >
              <span>{actionError}</span>
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss error"
                className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Quick-Add Task Composer */}
          <section aria-label="Add a new task">
            <form
              onSubmit={handleCreateTask}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={newTitle}
                  maxLength={TASK_TITLE_MAX}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (composerError) setComposerError(null);
                  }}
                  placeholder={
                    selectedList
                      ? `Add a task to ${selectedList}...`
                      : 'Add a new task...'
                  }
                  aria-label="New task title"
                  className="flex-1 min-w-0 px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowMoreOptions((prev) => !prev)}
                    className="px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {showMoreOptions ? 'Less' : 'Details'}
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingTask}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>{isAddingTask ? 'Adding...' : 'Add Task'}</span>
                  </button>
                </div>
              </div>

              {showMoreOptions && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <textarea
                    rows={2}
                    value={newNotes}
                    maxLength={TASK_NOTES_MAX}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Add optional notes or context..."
                    aria-label="Task notes"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 resize-none"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>List</span>
                      <select
                        value={selectedList || newListName}
                        disabled={selectedList !== null}
                        onChange={(e) => setNewListName(e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {availableLists.map((list) => (
                          <option key={list} value={list}>
                            {list}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>Priority</span>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {PRIORITY_VALUES.map((level) => (
                          <option key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>Due</span>
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>
              )}

              {composerError && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {composerError}
                </p>
              )}
            </form>
          </section>

          {/* Filter, Sort & Bulk Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              {(['all', 'active', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === tab
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {completedInView.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClearCompleted(completedInView)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Clear completed (<span className="font-mono">{completedInView.length}</span>)
                </button>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort tasks"
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest</option>
                  <option value="dueDate">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="title">Title</option>
                </select>
              </label>
            </div>
          </div>

          {/* Task List Surface */}
          <section aria-label="Task list">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              {loading ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800" aria-busy="true">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="px-4 py-4 flex items-center gap-3 animate-pulse">
                      <div className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                        <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visibleTasks.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="font-display text-base font-medium text-slate-900 dark:text-slate-100">
                    {tasks.length === 0
                      ? 'Your task list is empty'
                      : 'No tasks match this view'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    {tasks.length === 0
                      ? 'Add your first personal task above. Changes sync in real time across your signed-in sessions.'
                      : 'Try clearing your search query or switching back to All Tasks.'}
                  </p>
                  <div className="mt-5 flex justify-center gap-3">
                    {tasks.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => titleInputRef.current?.focus()}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Add first task
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setSelectedView('all');
                          setSelectedList(null);
                        }}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      availableLists={availableLists}
                      onToggle={onToggleTask}
                      onUpdate={onUpdateTask}
                      onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              )}

              {!loading && (
                <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  {(() => {
                    const remainingCount = selectedList
                      ? (counts.byList[selectedList] || 0)
                      : counts.active;
                    const noun = remainingCount === 1 ? 'task' : 'tasks';
                    return (
                      <span>
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                          {remainingCount}
                        </span>{' '}
                        incomplete {noun} remaining
                        {selectedList ? ` in ${selectedList}` : ''}
                      </span>
                    );
                  })()}

                  {counts.all > 0 && (
                    <span className="text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums">{counts.active}</span> active
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{counts.completed}</span> completed
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

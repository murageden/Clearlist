import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SignInView } from './components/SignInView';
import { WorkspaceView, type SyncStatus } from './components/WorkspaceView';
import { auth, db, googleProvider } from './lib/firebase';
import {
  getFriendlyErrorMessage,
  handleFirestoreError,
  OperationType,
} from './lib/firestoreErrors';
import {
  CUSTOM_LISTS_MAX,
  DEFAULT_LISTS,
  normalizeDisplayName,
  sanitizeListName,
  type TaskDraft,
  type TaskItem,
  type TaskPriority,
} from './lib/validation';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [customLists, setCustomLists] = useState<string[]>([...DEFAULT_LISTS]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    hasPendingWrites: false,
    fromCache: false,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('clearlist-theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('clearlist-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Propagate fatal Firestore listener errors to ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  // Track Firebase Auth readiness
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setTasks([]);
        setCustomLists([...DEFAULT_LISTS]);
        setTasksLoading(false);
        setActionError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listeners only when auth is ready and user is signed in
  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    setTasksLoading(true);

    // 1. User workspace preferences document (/users/{userId})
    const userDocPath = `users/${user.uid}`;
    const userDocRef = doc(db, 'users', user.uid);
    let initializedWorkspace = false;

    const unsubscribeUser = onSnapshot(
      userDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (Array.isArray(data.customLists)) {
            const validLists = data.customLists
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .slice(0, CUSTOM_LISTS_MAX);
            setCustomLists(validLists.length > 0 ? validLists : [...DEFAULT_LISTS]);
          }
        } else if (!initializedWorkspace && user.emailVerified) {
          initializedWorkspace = true;
          try {
            await setDoc(userDocRef, {
              uid: user.uid,
              displayName: normalizeDisplayName(user),
              customLists: [...DEFAULT_LISTS],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, userDocPath);
          }
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, userDocPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      },
    );

    // 2. Owner-isolated tasks real-time listener (/tasks where ownerId == user.uid)
    const tasksCollectionPath = 'tasks';
    const tasksQuery = query(
      collection(db, tasksCollectionPath),
      where('ownerId', '==', user.uid),
    );

    const unsubscribeTasks = onSnapshot(
      tasksQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const nextTasks: TaskItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: String(data.ownerId ?? user.uid),
            title: String(data.title ?? ''),
            notes: String(data.notes ?? ''),
            completed: Boolean(data.completed),
            priority: (data.priority as TaskPriority) || 'medium',
            listName: String(data.listName ?? 'Inbox'),
            dueDate: String(data.dueDate ?? ''),
            createdAt: (data.createdAt as Timestamp | null) ?? null,
            updatedAt: (data.updatedAt as Timestamp | null) ?? null,
          };
        });

        setTasks(nextTasks);
        setSyncStatus({
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
          fromCache: snapshot.metadata.fromCache,
        });
        setTasksLoading(false);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, tasksCollectionPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      },
    );

    return () => {
      unsubscribeUser();
      unsubscribeTasks();
    };
  }, [authReady, user]);

  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Your browser blocked the Google sign-in popup. Please allow popups and try again.');
      } else {
        setAuthError(getFriendlyErrorMessage(error));
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error));
    }
  }, []);

  const handleAddTask = useCallback(
    async (draft: TaskDraft) => {
      if (!user) return;
      const path = 'tasks';
      try {
        await addDoc(collection(db, path), {
          ownerId: user.uid,
          title: draft.title,
          notes: draft.notes,
          completed: false,
          priority: draft.priority,
          listName: draft.listName,
          dueDate: draft.dueDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        setActionError(getFriendlyErrorMessage(error));
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [user],
  );

  const handleToggleTask = useCallback(
    async (task: TaskItem) => {
      if (!user) return;
      const path = `tasks/${task.id}`;
      try {
        await updateDoc(doc(db, 'tasks', task.id), {
          completed: !task.completed,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        setActionError(getFriendlyErrorMessage(error));
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user],
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, draft: TaskDraft) => {
      if (!user) return;
      const path = `tasks/${taskId}`;
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          title: draft.title,
          notes: draft.notes,
          priority: draft.priority,
          listName: draft.listName,
          dueDate: draft.dueDate,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        setActionError(getFriendlyErrorMessage(error));
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (!user) return;
      const path = `tasks/${taskId}`;
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
      } catch (error) {
        setActionError(getFriendlyErrorMessage(error));
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user],
  );

  const handleClearCompleted = useCallback(
    async (completedTasks: TaskItem[]) => {
      if (!user || completedTasks.length === 0) return;
      const path = 'tasks';
      try {
        const batch = writeBatch(db);
        for (const task of completedTasks) {
          batch.delete(doc(db, 'tasks', task.id));
        }
        await batch.commit();
      } catch (error) {
        setActionError(getFriendlyErrorMessage(error));
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [user],
  );

  const handleAddCustomList = useCallback(
    async (rawName: string) => {
      if (!user) return;
      const cleanName = sanitizeListName(rawName);
      if (!cleanName || customLists.length >= CUSTOM_LISTS_MAX) return;
      const nextLists = Array.from(new Set([...customLists, cleanName])).slice(0, CUSTOM_LISTS_MAX);
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          customLists: nextLists,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        setActionError(getFriendlyErrorMessage(error));
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, customLists],
  );

  const handleRemoveCustomList = useCallback(
    async (name: string) => {
      if (!user) return;
      const nextLists = customLists.filter((item) => item !== name);
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          customLists: nextLists.length > 0 ? nextLists : ['Inbox'],
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        setActionError(getFriendlyErrorMessage(error));
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [user, customLists],
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <SignInView
        onSignIn={handleSignIn}
        isSigningIn={isSigningIn}
        authError={authError}
      />
    );
  }

  return (
    <WorkspaceView
      user={user}
      tasks={tasks}
      customLists={customLists}
      loading={tasksLoading}
      syncStatus={syncStatus}
      actionError={actionError}
      onDismissError={() => setActionError(null)}
      isDark={isDark}
      onToggleTheme={() => setIsDark((prev) => !prev)}
      onSignOut={handleSignOut}
      onAddTask={handleAddTask}
      onToggleTask={handleToggleTask}
      onUpdateTask={handleUpdateTask}
      onDeleteTask={handleDeleteTask}
      onClearCompleted={handleClearCompleted}
      onAddCustomList={handleAddCustomList}
      onRemoveCustomList={handleRemoveCustomList}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

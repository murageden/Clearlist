import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function parseFirestoreErrorInfo(error: unknown): FirestoreErrorInfo | null {
  if (!(error instanceof Error)) {
    return null;
  }
  try {
    const parsed = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string' && typeof parsed.operationType === 'string') {
      return parsed as FirestoreErrorInfo;
    }
  } catch {
    // Not a structured FirestoreErrorInfo JSON payload
  }
  return null;
}

export function getFriendlyErrorMessage(error: unknown): string {
  const info = parseFirestoreErrorInfo(error);
  const rawMessage = info ? info.error : error instanceof Error ? error.message : String(error);

  if (rawMessage.includes('Quota exceeded')) {
    return 'Daily Firestore quota has been exceeded. Quota resets tomorrow.';
  }
  if (rawMessage.includes('permission-denied') || rawMessage.includes('Missing or insufficient permissions')) {
    return 'Access denied by database security rules. Please verify you are signed in with a verified Google account.';
  }
  if (rawMessage.includes('offline') || rawMessage.includes('unavailable')) {
    return 'Unable to reach Firestore right now. Changes will sync automatically once your connection returns.';
  }
  return rawMessage || 'An unexpected error occurred.';
}

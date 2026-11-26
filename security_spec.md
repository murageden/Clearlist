# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Strict Owner Isolation (Tasks)**: Every document in `/tasks/{taskId}` must declare `ownerId == request.auth.uid`. Users can only `get`, `list`, `create`, `update`, and `delete` documents where `ownerId` matches their authenticated UID.
2. **Strict Owner Isolation (UserWorkspaces)**: Every document in `/users/{userId}` must have `userId == request.auth.uid` and `uid == request.auth.uid`. List queries on `/users` are strictly forbidden (`allow list: if false`). No PII (email, phone, address) is stored in Firestore.
3. **Email Verification Enforcement**: All writes (`create`, `update`, `delete`) require `request.auth.token.email_verified == true`.
4. **Immutable Ownership & Creation Time**: `ownerId`, `uid`, and `createdAt` can never be mutated after creation.
5. **Server Timestamp Integrity**: `createdAt` (on create) and `updatedAt` (on create and update) must strictly equal `request.time`.
6. **Strict Schema & Bounds**: Unknown shadow fields are rejected via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update. All strings and arrays have explicit length bounds matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Task Create**: Authenticated user `user_A` creates a task with `ownerId: "user_B"` -> `PERMISSION_DENIED`.
2. **Cross-User Task Read (`get`)**: Authenticated user `user_A` requests `get /tasks/task_owned_by_B` -> `PERMISSION_DENIED`.
3. **Unfiltered Collection Scraping (`list`)**: Authenticated user `user_A` executes `list /tasks` without `where('ownerId', '==', 'user_A')` -> `PERMISSION_DENIED`.
4. **Cross-User Task Update**: Authenticated user `user_A` attempts to toggle `completed: true` on a task owned by `user_B` -> `PERMISSION_DENIED`.
5. **Cross-User Task Delete**: Authenticated user `user_A` attempts to delete a task owned by `user_B` -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection**: Owner injects `{ ..., isAdmin: true }` or `{ ..., sharedWith: ["user_B"] }` -> `PERMISSION_DENIED`.
7. **Ownership Reassignment on Update**: Owner sends `update` changing `ownerId` from `user_A` to `user_B` -> `PERMISSION_DENIED`.
8. **Client-Spoofed Timestamp**: Owner creates or updates a task with `createdAt: new Date('2020-01-01')` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Immutable `createdAt` Mutation**: Owner sends `update` altering `createdAt` -> `PERMISSION_DENIED`.
10. **Denial-of-Wallet Resource Poisoning**: Owner sends `title` of 5,000 characters (`> 160`), `notes` of 10,000 characters (`> 1000`), or a 500-char document ID (`> 128`) -> `PERMISSION_DENIED`.
11. **Type & Enum Poisoning**: Owner updates `completed: "yes"` (string instead of bool) or `priority: "urgent"` (not in `['low', 'medium', 'high']`) -> `PERMISSION_DENIED`.
12. **Unverified Email Write / User List Scraping**: Unverified account (`email_verified: false`) attempts to create a task, or any user attempts `list /users` -> `PERMISSION_DENIED`.

# Luu Kyone Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Every document not matched by an explicit collection rule is denied read and write access.
2. **Role-Gated Admin Console**: Only users whose `/users/{request.auth.uid}` document has `role == 'admin'` and `isSuspended != true` (or the verified bootstrap admin `thureinlynn.mm@gmail.com`) hold admin privileges.
3. **No Self-Assigned Privileges**: Non-admin users creating or updating their own `/users/{uid}` document cannot set `role: 'admin'`, `isVerified: true`, or `verificationStatus: 'Verified'`.
4. **PII Isolation**: User documents containing `email` and `phone` can only be read by the document owner (`request.auth.uid == userId`) or an active admin (`isAdmin()`).
5. **Trip Ownership & Terminal Lock**: Travelers can only create/update/delete trips referencing their own `travelerId == request.auth.uid`, and cannot mutate completed trips without admin override.
6. **Immutable Audit Trail**: `audit_logs` are append-only by admins; updates and deletes are strictly forbidden.
7. **Input Volumetric Bounds**: All document IDs match `^[a-zA-Z0-9_\\-]+$` (<= 128 chars) and every string/list field enforces strict `.size()` upper bounds.

## 2. Adversarial Test Matrix ("Dirty Dozen")
1. Unauthenticated read on `/users/{uid}` -> `PERMISSION_DENIED`
2. Non-admin `get` on another user's `/users/{otherUid}` -> `PERMISSION_DENIED`
3. Non-admin `list` on `/users` without filtering to own `uid` -> `PERMISSION_DENIED`
4. Self-registration payload with `role: 'admin'` -> `PERMISSION_DENIED`
5. Self-update payload setting `isVerified: true` -> `PERMISSION_DENIED`
6. Spoofed unverified email token claiming admin email -> `PERMISSION_DENIED`
7. Trip creation with `travelerId != request.auth.uid` by non-admin -> `PERMISSION_DENIED`
8. Trip update with oversized 1MB `notes` string -> `PERMISSION_DENIED`
9. Traveler updating a trip already marked `Completed` -> `PERMISSION_DENIED`
10. Non-admin creating/deleting an `/announcements/{id}` banner -> `PERMISSION_DENIED`
11. Any client attempting `update` or `delete` on `/audit_logs/{id}` -> `PERMISSION_DENIED`
12. Document ID exceeding 128 chars or containing invalid characters -> `PERMISSION_DENIED`

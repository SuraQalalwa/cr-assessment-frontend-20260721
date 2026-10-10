# Implementation Notes

## 1. What I changed

### Task 1 — Bug Fixes

- **Line item diffing (`src/components/diff.util.ts`)**: Fixed `computeDiff` to detect changes across `unitPrice`, `quantity`, and `description`. Previously, only `unitPrice` was evaluated, causing quantity or description modifications to be misclassified as `'unchanged'`.
- **Permission gating (`src/components/cr-detail/cr-detail.component.ts`)**: Updated `canApprove` and `canReject` getters to check `canApprovePolicy(this.session.user)` in addition to the CR status (`PENDING_APPROVAL`). This prevents read-only viewers (`cr_r_o`) from acting.

### Task 2 — List Filtering

- **Status Filter (`src/components/cr-list/cr-list.component.ts`)**: Implemented `visibleRows` so that selecting `'ALL'` returns all rows without filtering, and selecting a specific status filters by `cr.status === this.statusFilter`.

### Task 3 — Detail View & Actions

- **Chronological Timeline**: Sorted audit entries in the `timeline` getter chronologically (oldest-first) using a shallow copy (`[...audit].sort()`) to prevent in-place mutation of the domain model.
- **Reject Reason Validation**: Added `Validators.required` and non-whitespace validation (`Validators.pattern(/.*\S.*/)`) and `Validators.minLength` to `rejectControl`, ensuring the Reject button remains disabled until a meaningful reason is entered.
- **Approve Action**: Implemented `approve()` with guard checks against double-submission (`submitting`), API invocation with an ISO timestamp, state updates, and error capturing (`actionError`).
- **Reject Action**: Implemented `reject()` with validation guards, API invocation passing the trimmed reason, form reset, and error handling.

### Task 4 — UX & Lifecycle Polish

- **Master-Detail Synchronisation**: Implemented Angular's `OnChanges` lifecycle hook on `CrDetailComponent` so selecting a different row in the list re-loads the detail panel.
- **Error Recovery**: Retained and tested explicit retry mechanisms across both list and detail views.

### Task 5 — Tests

- Expanded test suites across `diff.spec.ts`, `cr-list.component.spec.ts`, and `cr-detail.component.spec.ts` from 7 tests to 22 tests, covering edge cases, user interactions, and error paths.

---

## 2. Component & state model

- **Layout**: `AppComponent` hosts `CrListComponent` (left master pane) and `CrDetailComponent` (right detail pane), along with the "Acting as" user switcher in the header.
- **ViewState Pattern**: Both components leverage a discriminated union `ViewState<T>` (`idle | loading | loaded | empty | error`), guaranteeing explicit, non-overlapping UI states (no simultaneous data and error states).
- **Data Flow**: Data flows unidirectionally. The list component emits `select(id)`, updating `selectedId` in `AppComponent`, which is bound to `CrDetailComponent` via `@Input() id`.
- **RBAC Policy Evaluation**: Components inject `SessionService` and use `canApprovePolicy(user)` to determine whether actions should be offered/enabled.

---

## 3. Invariants I keep

| Invariant | How / Where ----------------------------------------------------------------------------------------------------- |
| Only authorized users can act | `canApprove` and `canReject` check `canApprovePolicy(user)` and `PENDING_APPROVAL` status. |
| No concurrent / duplicate actions | `submitting` flag disables action buttons and guards `approve()` / `reject()` entry. |
| Non-empty rejection reasons | `rejectControl` enforces `required` and non-whitespace regex; Reject button is disabled when invalid. |
| Immutability during audit sort | Shallow array copy created before sorting in `timeline` getter. |
| Dynamic master-detail updates | `ngOnChanges` in `CrDetailComponent` triggers `load()` on `@Input() id` change. |
| Graceful network error handling | API errors captured in `actionError` (actions) and `state.error` (page load) with retry options. |

---

## 4. Testing strategy

- **Pure unit tests (`diff.spec.ts`)**: Fast, isolated tests for line-item diffing (additions, removals, quantity changes, unit price changes, description changes, and identical items).

---

## 5. Assumptions

- **Rejection Authority**: Rejection authority follows approval policy (`canApprovePolicy`), as no separate `cr_reject_*` policy exists in the specification.
- **Rejection Reasons**: Reasons containing only whitespace characters (`"   "`) or minLength less than `5` are considered invalid.

---

## 6. Where I used AI

- **Tasks 4 & 5 (UX States & Test Coverage)**: Used AI as a pair programmer to help implement master-detail synchronization, design edge-case scenarios, and expand unit test coverage across the test suites.
- **Documentation**: Assisted in drafting and structuring `IMPLEMENTATION_NOTES.md`.
- **Final Requirements Verification**: Used AI to perform a comprehensive walkthrough and audit against all required acceptance criteria in the candidate brief to ensure every requirement was fully satisfied.

---

## 7. What I'd improve with more time

1. **Action Confirmation Dialogs**:
   - Add modal confirmation dialogs before executing terminal actions (`Approve` or `Reject`) to prevent accidental clicks.
2. **Toast / Notification Feedback System**:
   - Complement inline error banners with a global toast notification service (e.g. _"Change Request CR-1 approved successfully"_ with auto-dismiss).
3. **Pagination, Search, & Sorting**:
   - Add search by title/ID and sorting by column headers (`updatedAt`, `delta`, `status`) to handle enterprise datasets with hundreds of CRs.
4. **Enhanced Diff Visualization**:
   - Provide visual highlights inside the diff table (e.g. green delta pill for `+1` quantity, strikethrough on previous unit price, colored tags for added/removed items).

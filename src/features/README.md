# Feature code

Routes and navigation stay in src/app. Shared visual components stay in src/components.

- users/components: user creation and signup workflow.
- venues/components: venue creation workflow.
- management/components: shared user/venue list and editor workflows.
- management/form.ts: existing field definitions, validation, record helpers and edit payloads (moved without logic changes).

HTTP transport stays in src/services/api.ts; session state stays in src/context/session.tsx. Platform-specific shared components and starter screens are retained to preserve existing behavior.

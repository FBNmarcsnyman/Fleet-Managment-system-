# Handover Document for FBN Fleet Management System
Generated: 2026-05-17

This project is a React 18 + TypeScript + Vite application. It uses a domain-driven multi-context state management system.

## 1. How to export the full source code
Use the **Settings (gear icon)** at the bottom left of the preview screen to:
- **Export to ZIP**: Get all files immediately.
- **GitHub Sync**: Push the entire repo to GitHub.

---

## 2. Project Architecture Logic
The application state is split into domain-specific contexts to prevent global re-renders. 
- **RawDataContext**: The single source of truth using a `useReducer` and syncing to `localStorage`.
- **Domain Contexts**: `Fleet`, `Operations`, `Workshop`, `Management`, `Common`, `Auth`, `UI`. These wrap the Raw state and provide specific handlers/actions.

---

## 3. Core Wiring (Source Code)

### types.ts
```typescript
[PASTE_TYPES_HERE]
```

### AppContexts.tsx (Hub)
```typescript
[PASTE_APP_CONTEXTS_HERE]
```

### FleetContext.tsx (Example Domain Context)
```typescript
[PASTE_FLEET_CONTEXT_HERE]
```

---

## 4. File Inventory
The project follows this structure:
- `/src/`
  - `App.tsx` (Main entry point, routing, and modal registry)
  - `types.ts` (All global interfaces)
  - `mockData.ts` (Initial seed data)
  - `contexts/` (State containers)
  - `components/` (UI split into domain folders: fleet, operations, workshop, etc.)
  - `hooks/` (Shared logic like `useServiceStatus`)
  - `constants.ts` (Config values)

---

## 5. Deployment Info
- Port: 3000
- Host: 0.0.0.0
- Persistence: LocalStorage (v3.1)

# Handover to Claude - FBN Fleet Management System

Upload this file to Claude to give it a complete understanding of your current app's "Brain" and architecture.

## 1. Project Overview
- **Tech Stack**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts.
- **State Management**: Domain-driven Context API (split into Fleet, Operations, Workshop, Management).
- **Persistence**: Data is saved in Browser `localStorage` (v3.1).

---

## 2. Core Architecture Summary
The application state is split into domain-specific contexts to prevent global re-renders. 
- **RawDataContext**: The single source of truth using a `useReducer` and syncing to `localStorage`.
- **Domain Contexts**: `Fleet`, `Operations`, `Workshop`, `Management`, `Common`, `Auth`, `UI`. These wrap the Raw state and provide specific handlers/actions.
- **Modals**: All modals are registered in `App.tsx` and triggered via `showModal(type, payload)` from `UIContext`.

---

## 3. Core Wiring (Pilar Files)

### types.ts (Data Models)
```typescript
[PASTE] -- See the actual types.ts file in the ZIP for the latest 600 lines of interfaces.
```

### RawDataContext.tsx (State Engine)
```typescript
[PASTE] -- See the actual RawDataContext.tsx for the full Reducer logic.
```

### AppContexts.tsx (Hub)
```typescript
import React, { ReactNode } from 'react';
import { RawDataProvider } from './RawDataContext';
import { CommonDataProvider } from './CommonDataContext';
import { FleetDataProvider } from './FleetContext';
import { OperationsDataProvider } from './OperationsContext';
import { WorkshopDataProvider } from './WorkshopContext';
import { ManagementDataProvider } from './ManagementContext';
import { AuthProvider } from './AuthContext';
import { UIProvider } from './UIContext';

export { useAuth } from './AuthContext';
export { useUIState } from './UIContext';
export { useCommonData } from './CommonDataContext';
export { useFleetData, useVehicles } from './FleetContext';
export { useOperations } from './OperationsContext';
export { useWorkshop } from './WorkshopContext';
export { useManagement } from './ManagementContext';

export const AppProviders: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <RawDataProvider>
      <CommonDataProvider>
        <AuthProvider>
          <UIProvider>
            <FleetDataProvider>
              <OperationsDataProvider>
                <WorkshopDataProvider>
                  <ManagementDataProvider>
                    {children}
                  </ManagementDataProvider>
                </WorkshopDataProvider>
              </OperationsDataProvider>
            </FleetDataProvider>
          </UIProvider>
        </AuthProvider>
      </CommonDataProvider>
    </RawDataProvider>
  );
};
```

---

## 4. Key Next Steps for Claude
- Continue building out the **Finance Portal** dashboards.
- Refine the **Incident Management** workflow for claims.
- Enhance the **AI Dispatch Assistant** in the Operations portal.

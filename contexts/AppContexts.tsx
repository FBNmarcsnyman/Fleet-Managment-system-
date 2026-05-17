
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
export { useCommonData, useCommonData as useNotifications, useCommonData as useMessages } from './CommonDataContext';
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

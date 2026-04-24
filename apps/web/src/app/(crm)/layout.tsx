import { DashboardShell } from '@/components/shell/DashboardShell';
import { PortalAuthGate } from '@/components/PortalAuthGate';
import { WorkspaceGate } from '@/components/WorkspaceGate';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <PortalAuthGate>
        <WorkspaceGate>{children}</WorkspaceGate>
      </PortalAuthGate>
    </DashboardShell>
  );
}

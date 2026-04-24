import { SuperAdminShell } from '@/components/platform/SuperAdminShell';

export default function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminShell>{children}</SuperAdminShell>;
}

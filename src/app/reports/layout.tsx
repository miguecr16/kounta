'use client';

import DashboardLayout from '@/app/dashboard/layout';

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

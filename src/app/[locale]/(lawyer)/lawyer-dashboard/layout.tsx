import LawyerShell from '@/components/lawyer/lawyer-shell';

export default function LawyerDashboardLayout({ children }: { children: React.ReactNode }) {
    return <LawyerShell>{children}</LawyerShell>;
}

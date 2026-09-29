import LawyerProGate from '@/components/lawyer/lawyer-pro-gate';

// ขึ้นกับสิทธิ์ของแพลน (caseManagement) — แอดมินปรับได้ ดู lib/lawyer-entitlements
// dynamic: แพลน/สิทธิ์เปลี่ยนได้ตลอด ห้าม cache ผลการเช็ค
export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: React.ReactNode }) {
    return <LawyerProGate feature="caseManagement">{children}</LawyerProGate>;
}

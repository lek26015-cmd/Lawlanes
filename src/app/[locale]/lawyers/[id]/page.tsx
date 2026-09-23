import { notFound } from 'next/navigation';
import { getPublicLawyerAction } from '@/app/actions/lawyer-directory-actions';
import LawyerProfileClient from './LawyerProfileClient';
import { Metadata } from 'next';

type Props = {
  params: Promise<{ id: string; locale: string }>
}

export async function generateMetadata(
  props: Props
): Promise<Metadata> {
    const params = await props.params;
    const { id } = params;
    // อ่านผ่าน Admin SDK + projection สาธารณะ — เดิมใช้ client SDK แบบไม่ล็อกอินบน server
    // ซึ่งดึงเอกสารเต็ม (เบอร์/ที่อยู่/เลขบัญชี) และจะพังทันทีที่ rules ปิด get
    const lawyer = await getPublicLawyerAction(id);

    if (!lawyer) {
        return {
            title: 'Lawyer Not Found - Lawslane',
        };
    }

    const title = `ทนายความ ${lawyer.name} - Lawslane`;
    const description = lawyer.description || `ข้อมูลโปรไฟล์ของทนายความ ${lawyer.name} บนระบบ Lawslane`;
    const imageUrl = lawyer.imageUrl || 'https://lawslane.com/icon.jpg';

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: lawyer.name,
                },
            ],
            type: 'profile',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        },
    };
}

export default async function LawyerProfilePage(props: Props) {
    const params = await props.params;
    const { id } = params;
    // หน้านี้ต้องเปิดดูได้โดยไม่ล็อกอิน (PRD.md) — จึงคืนแค่ PublicLawyer
    const lawyer = await getPublicLawyerAction(id);

    if (!lawyer) {
        notFound();
    }

    return <LawyerProfileClient initialLawyer={lawyer} id={id} />;
}

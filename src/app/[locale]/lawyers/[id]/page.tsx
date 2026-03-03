import { getLawyerById } from '@/lib/data';
import { notFound } from 'next/navigation';
import { initializeFirebase } from '@/firebase';
import LawyerProfileClient from './LawyerProfileClient';
import { Metadata } from 'next';

interface Props {
    params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const { firestore } = initializeFirebase();
    const lawyer = await getLawyerById(firestore, id);

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

export default async function LawyerProfilePage({ params }: Props) {
    const { id } = await params;
    const { firestore } = initializeFirebase();
    const lawyer = await getLawyerById(firestore, id);

    if (!lawyer) {
        notFound();
    }

    return <LawyerProfileClient initialLawyer={lawyer} id={id} />;
}

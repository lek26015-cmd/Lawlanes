import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicInterpreterAction } from '@/app/actions/interpreter-directory-actions';
import InterpreterProfileClient from './InterpreterProfileClient';

type Props = { params: Promise<{ id: string; locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { id } = await props.params;
    const interpreter = await getPublicInterpreterAction(id);
    if (!interpreter) return { title: 'Interpreter Not Found - Lawslane' };
    const title = `${interpreter.name} - Legal Interpreter | Lawslane`;
    const description = interpreter.description.slice(0, 160);
    const images = interpreter.imageUrl ? [interpreter.imageUrl] : ['https://lawslane.com/icon.jpg'];
    return {
        title,
        description,
        openGraph: { title, description, images, type: 'profile' },
        twitter: { card: 'summary', title, description, images },
    };
}

// เปิดดูได้โดยไม่ล็อกอิน — ข้อมูลเป็น PublicInterpreter (allowlist) เท่านั้น
export default async function InterpreterProfilePage(props: Props) {
    const { id } = await props.params;
    const interpreter = await getPublicInterpreterAction(id);
    if (!interpreter) notFound();
    return <InterpreterProfileClient interpreter={interpreter} />;
}

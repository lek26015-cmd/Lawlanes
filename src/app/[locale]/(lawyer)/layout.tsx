import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Lawslane Lawyer System',
    description: 'ระบบสำหรับทนายความ Lawslane',
    icons: {
        icon: '/icon.jpg',
    },
};

export default async function LawyerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
        </>
    );
}

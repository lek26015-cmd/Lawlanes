import { notFound } from 'next/navigation';
import { getPublicInterpreterAction } from '@/app/actions/interpreter-directory-actions';
import { getPlatformPaymentAccountAction } from '@/app/actions/interpreter-booking-actions';
import BookInterpreterClient from './BookInterpreterClient';

export const dynamic = 'force-dynamic';

export default async function BookInterpreterPage(props: { params: Promise<{ id: string; locale: string }> }) {
    const { id } = await props.params;
    const [interpreter, account] = await Promise.all([
        getPublicInterpreterAction(id),
        getPlatformPaymentAccountAction(),
    ]);
    if (!interpreter) notFound();
    return <BookInterpreterClient interpreter={interpreter} paymentAccount={account} />;
}

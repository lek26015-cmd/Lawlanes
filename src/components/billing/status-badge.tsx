import React from 'react';
import { InvoiceStatus } from '@/lib/types/billing-types';

interface StatusBadgeProps {
  status: InvoiceStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles: Record<InvoiceStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    overdue: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  const labels: Record<InvoiceStatus, string> = {
    pending: 'รอการชำระ',
    paid: 'ชำระแล้ว',
    overdue: 'เกินกำหนด',
  };

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

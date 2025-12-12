import React from 'react';
import { LucideIcon, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: LucideIcon;
    title?: string;
    description?: string;
    className?: string;
}

export function EmptyState({
    icon: Icon = SearchX,
    title = 'ไม่พบข้อมูล',
    description = 'ขออภัย ไม่พบข้อมูลที่คุณต้องการในขณะนี้',
    className,
}: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
            <div className="bg-muted/30 p-4 rounded-full mb-4">
                <Icon className="w-12 h-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {description}
            </p>
        </div>
    );
}

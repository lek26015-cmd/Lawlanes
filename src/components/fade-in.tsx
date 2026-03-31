'use client';

import React, { useEffect, useState, useRef } from 'react';

interface FadeInProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    direction?: 'up' | 'down' | 'left' | 'right' | 'none';
    fullWidth?: boolean;
}

export function FadeIn({
    children,
    className = "",
    delay = 0,
    direction = 'up',
    fullWidth = false
}: FadeInProps) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    const getTransform = () => {
        if (!isVisible) {
            switch (direction) {
                case 'up': return 'translate-y-8 translate-x-0 scale-100';
                case 'down': return '-translate-y-8 translate-x-0 scale-100';
                case 'left': return 'translate-y-0 translate-x-8 scale-100';
                case 'right': return 'translate-y-0 -translate-x-8 scale-100';
                case 'none': return 'translate-y-0 translate-x-0 scale-95';
                default: return 'translate-y-8 translate-x-0 scale-100';
            }
        }
        return 'translate-y-0 translate-x-0 scale-100';
    };

    return (
        <div
            ref={ref}
            className={`${className} transition-all duration-700 ease-out ${isVisible ? 'opacity-100 blur-none' : 'opacity-0 blur-sm'
                } ${getTransform()} ${fullWidth ? 'w-full' : ''}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

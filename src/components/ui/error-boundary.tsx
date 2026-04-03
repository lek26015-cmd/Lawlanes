'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 border border-red-200 rounded-3xl h-full min-h-[300px]">
          <div className="p-3 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-800 mb-2">เกิดข้อผิดพลาดในการแสดงผล</h2>
          <p className="text-red-600 text-sm mb-6 max-w-xs mx-auto">
            ขออภัย ระบบแชทขัดข้องชั่วคราว คุณสามารถลองรีเฟรชเฉพาะส่วนนี้ได้
          </p>
          <Button 
            variant="outline" 
            onClick={() => this.setState({ hasError: false })}
            className="rounded-full border-red-200 text-red-700 hover:bg-red-100"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            ลองใหม่อีกครั้ง
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

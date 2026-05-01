import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function ConsultExpertCard() {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 my-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 bg-orange-100 p-2 rounded-full text-orange-600">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-orange-900 mb-1">
            This issue requires professional legal advice
          </h4>
          <p className="text-orange-700 text-sm mb-3">
            This situation involves complex legal nuances that an AI cannot fully address. We strongly recommend consulting with a specialized lawyer.
          </p>
          <Button asChild variant="default" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white shadow-sm">
            <Link href="/lawyers">
              Browse Specialized Lawyers
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

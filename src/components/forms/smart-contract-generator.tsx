'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, ChevronRight, ChevronLeft, Download, FileText, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

// Zod Schema
const formSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyAddress: z.string().min(5, "Address is required"),
  counterpartyName: z.string().min(2, "Counterparty name is required"),
  counterpartyEmail: z.string().email("Invalid email address"),
  contractDate: z.string().min(1, "Date is required"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  { id: 1, title: 'Company Info' },
  { id: 2, title: 'Counterparty Info' },
  { id: 3, title: 'Terms & Conditions' },
  { id: 4, title: 'Review & Actions' },
];

export function SmartContractGenerator() {
  const [currentStep, setCurrentStep] = useState(1);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
  });

  const formValues = watch();

  const handleNext = async () => {
    let fieldsToValidate: (keyof FormValues)[] = [];
    if (currentStep === 1) fieldsToValidate = ['companyName', 'companyAddress'];
    if (currentStep === 2) fieldsToValidate = ['counterpartyName', 'counterpartyEmail'];
    if (currentStep === 3) fieldsToValidate = ['contractDate', 'paymentTerms'];

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const onSubmit = (data: FormValues) => {
    console.log("Form Completed:", data);
    // Proceed to step 4 (Review) automatically handled by handleNext
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border overflow-hidden">
      {/* Progress Bar Header */}
      <div className="bg-slate-50 border-b px-8 py-6">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Smart Contract Generator</h2>
        
        <div className="relative flex justify-between">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full" />
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
          
          {STEPS.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div key={step.id} className="relative flex flex-col items-center group">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors shadow-sm z-10
                    ${isCompleted ? 'bg-indigo-600 text-white' : 
                      isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-white border-2 border-slate-200 text-slate-400'}`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </div>
                <span className={`absolute top-10 w-max text-xs font-medium ${isCurrent ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <div className="p-8 mt-4 min-h-[400px]">
        {currentStep < 4 ? (
          <form className="max-w-2xl mx-auto space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Your Company Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" {...register('companyName')} placeholder="e.g. Acme Corp" className={errors.companyName ? 'border-red-500' : ''} />
                  {errors.companyName && <p className="text-red-500 text-sm">{errors.companyName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Registered Address</Label>
                  <Input id="companyAddress" {...register('companyAddress')} placeholder="123 Business Rd..." className={errors.companyAddress ? 'border-red-500' : ''} />
                  {errors.companyAddress && <p className="text-red-500 text-sm">{errors.companyAddress.message}</p>}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Counterparty Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="counterpartyName">Counterparty Name</Label>
                  <Input id="counterpartyName" {...register('counterpartyName')} placeholder="e.g. Globex Inc" className={errors.counterpartyName ? 'border-red-500' : ''} />
                  {errors.counterpartyName && <p className="text-red-500 text-sm">{errors.counterpartyName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="counterpartyEmail">Contact Email</Label>
                  <Input type="email" id="counterpartyEmail" {...register('counterpartyEmail')} placeholder="contact@globex.com" className={errors.counterpartyEmail ? 'border-red-500' : ''} />
                  {errors.counterpartyEmail && <p className="text-red-500 text-sm">{errors.counterpartyEmail.message}</p>}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Terms & Conditions</h3>
                <div className="space-y-2">
                  <Label htmlFor="contractDate">Effective Date</Label>
                  <Input type="date" id="contractDate" {...register('contractDate')} className={errors.contractDate ? 'border-red-500' : ''} />
                  {errors.contractDate && <p className="text-red-500 text-sm">{errors.contractDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms (e.g. Net 30)</Label>
                  <Input id="paymentTerms" {...register('paymentTerms')} placeholder="Net 30" className={errors.paymentTerms ? 'border-red-500' : ''} />
                  {errors.paymentTerms && <p className="text-red-500 text-sm">{errors.paymentTerms.message}</p>}
                </div>
              </div>
            )}
          </form>
        ) : (
          /* Step 4: Split Screen Review */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-in fade-in zoom-in-95">
            {/* Left: Document Preview */}
            <div className="bg-slate-50 border rounded-xl p-6 shadow-inner h-[500px] overflow-y-auto">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <FileText className="w-5 h-5 text-slate-500" />
                <h3 className="font-semibold text-slate-700">Contract Preview</h3>
              </div>
              <div className="prose prose-sm text-slate-600">
                <h2 className="text-center">SERVICE AGREEMENT</h2>
                <p>This Service Agreement is made effective as of <strong className="text-slate-900">{formValues.contractDate || '[Date]'}</strong>.</p>
                <p><strong>BETWEEN:</strong> <strong className="text-slate-900">{formValues.companyName || '[Company]'}</strong>, located at <span className="text-slate-900">{formValues.companyAddress || '[Address]'}</span>.</p>
                <p><strong>AND:</strong> <strong className="text-slate-900">{formValues.counterpartyName || '[Counterparty]'}</strong>, with contact email <span className="text-slate-900">{formValues.counterpartyEmail || '[Email]'}</span>.</p>
                <h3>1. Payment Terms</h3>
                <p>The parties agree to the following payment terms: <strong className="text-slate-900">{formValues.paymentTerms || '[Terms]'}</strong>.</p>
                <p>...</p>
                <p className="text-slate-400 italic mt-8">[End of Draft Preview]</p>
              </div>
            </div>

            {/* Right: CTA Panel */}
            <div className="flex flex-col justify-center space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-800">Your Draft is Ready</h3>
                <p className="text-slate-600">
                  You can download this draft immediately. However, to ensure your business is fully protected, we highly recommend having a verified lawyer review it before signing.
                </p>
              </div>

              <div className="space-y-4">
                <Button className="w-full h-12 text-base bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 shadow-sm">
                  <Download className="w-5 h-5 mr-2" />
                  Download Draft (PDF)
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400 font-medium">Recommended</span>
                  </div>
                </div>

                <Button asChild className="w-full h-14 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                  <Link href="/lawyers">
                    <Scale className="w-5 h-5 mr-2" />
                    Have a Lawyer Review This
                  </Link>
                </Button>
                <p className="text-xs text-center text-slate-500">
                  Connect with a specialized lawyer from the Lawslane Marketplace in minutes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      {currentStep < 4 && (
        <div className="bg-slate-50 border-t px-8 py-4 flex justify-between items-center mt-4">
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            disabled={currentStep === 1}
            className="text-slate-600"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          
          <Button 
            onClick={currentStep === 3 ? handleSubmit(onSubmit) : handleNext}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            {currentStep === 3 ? 'Generate Contract' : 'Next Step'} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

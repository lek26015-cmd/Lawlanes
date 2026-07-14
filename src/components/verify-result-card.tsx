'use client';

import { ShieldCheck, ShieldAlert, MapPin, Calendar, UserPlus, ExternalLink, BadgeCheck, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Link } from '@/navigation';
import profileLawyerImg from '@/pic/profile-lawyer.jpg';
import { getCloudflareVariantUrl } from '@/lib/cloudflare-images';
import { useTranslations } from 'next-intl';

export interface VerifyResult {
    id: string;
    name: string;
    licenseNumber: string;
    status: 'active' | 'suspended' | 'struck_off' | 'pending';
    province?: string;
    registeredDate?: string;
    // Fields only available if on Lawslane
    isOnLawslane: boolean;
    lawslaneProfileId?: string;
    imageUrl?: string;
    specialty?: string[];
    source: 'lawslane' | 'registry' | 'both';
}

interface VerifyResultCardProps {
    result: VerifyResult;
}

export default function VerifyResultCard({ result }: VerifyResultCardProps) {
    const t = useTranslations('VerifyLawyer');

    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
        active: {
            label: t('status.active'),
            color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            icon: <ShieldCheck className="w-3.5 h-3.5" />,
        },
        suspended: {
            label: t('status.suspended'),
            color: 'bg-amber-50 text-amber-700 border-amber-200',
            icon: <ShieldAlert className="w-3.5 h-3.5" />,
        },
        struck_off: {
            label: t('status.struckOff'),
            color: 'bg-red-50 text-red-700 border-red-200',
            icon: <ShieldAlert className="w-3.5 h-3.5" />,
        },
        pending: {
            label: t('status.pending'),
            color: 'bg-slate-50 text-slate-600 border-slate-200',
            icon: <ShieldAlert className="w-3.5 h-3.5" />,
        },
    };

    const currentStatus = statusConfig[result.status] || statusConfig.pending;

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/verify-lawyer?licenseNumber=${encodeURIComponent(result.licenseNumber)}`;
        const shareText = `ตรวจสอบสถานะทนายความ ${result.name} บน Lawslane`;

        if (navigator.share) {
            try {
                await navigator.share({ title: shareText, url: shareUrl });
            } catch { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(shareUrl);
        }
    };

    // === Card Type A: Lawyer is on Lawslane ===
    if (result.isOnLawslane && result.lawslaneProfileId) {
        return (
            <div className="group relative bg-white rounded-2xl border-2 border-emerald-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Top Badge Bar */}
                <div className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                    <BadgeCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700">{t('card.onLawslane')}</span>
                </div>

                <div className="p-5 md:p-6">
                    <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                        {/* Profile Image */}
                        <div className="relative h-20 w-20 flex-shrink-0">
                            {result.imageUrl ? (
                                <img
                                    src={getCloudflareVariantUrl(result.imageUrl, 'public') || result.imageUrl}
                                    alt={result.name}
                                    className="w-full h-full rounded-full object-cover ring-4 ring-white shadow-md"
                                    onError={(e) => { e.currentTarget.src = '/images/profile-lawyer.jpg'; }}
                                />
                            ) : (
                                <Image
                                    src={profileLawyerImg}
                                    alt={result.name}
                                    fill
                                    className="rounded-full object-cover ring-4 ring-white shadow-md"
                                />
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-grow text-center sm:text-left">
                            <h3 className="text-xl font-bold text-slate-800">{result.name}</h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {t('resultFound.licenseNumber')} {result.licenseNumber}
                            </p>

                            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                                <Badge className={`${currentStatus.color} border font-medium gap-1`} variant="outline">
                                    {currentStatus.icon}
                                    {currentStatus.label}
                                </Badge>
                                {result.province && (
                                    <Badge variant="outline" className="text-slate-500 border-slate-200 gap-1 font-normal">
                                        <MapPin className="w-3 h-3" />
                                        {result.province}
                                    </Badge>
                                )}
                                {result.registeredDate && (
                                    <Badge variant="outline" className="text-slate-500 border-slate-200 gap-1 font-normal">
                                        <Calendar className="w-3 h-3" />
                                        {result.registeredDate}
                                    </Badge>
                                )}
                            </div>

                            {result.specialty && result.specialty.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3 justify-center sm:justify-start">
                                    {result.specialty.slice(0, 3).map((spec, i) => (
                                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                                            {spec}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-shrink-0 mt-2 sm:mt-0">
                            <Button asChild className="bg-[#0B3979] hover:bg-[#082a5a] text-white rounded-xl shadow-md">
                                <Link href={`/lawyers/${result.lawslaneProfileId}`}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    {t('resultFound.viewProfile')}
                                </Link>
                            </Button>
                            <Button variant="outline" className="rounded-xl border-slate-200" onClick={handleShare}>
                                <Share2 className="w-4 h-4 mr-2" />
                                {t('card.share')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // === Card Type B: Lawyer NOT on Lawslane (registry only) ===
    return (
        <div className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Top Badge Bar */}
            <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">{t('card.registryOnly')}</span>
            </div>

            <div className="p-5 md:p-6">
                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                    {/* Placeholder Avatar */}
                    <div className="relative h-20 w-20 flex-shrink-0">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center ring-4 ring-white shadow-md">
                            <ShieldCheck className="w-10 h-10 text-slate-300" />
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-grow text-center sm:text-left">
                        <h3 className="text-xl font-bold text-slate-800">{result.name}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {t('resultFound.licenseNumber')} {result.licenseNumber}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                            <Badge className={`${currentStatus.color} border font-medium gap-1`} variant="outline">
                                {currentStatus.icon}
                                {currentStatus.label}
                            </Badge>
                            {result.province && (
                                <Badge variant="outline" className="text-slate-500 border-slate-200 gap-1 font-normal">
                                    <MapPin className="w-3 h-3" />
                                    {result.province}
                                </Badge>
                            )}
                            {result.registeredDate && (
                                <Badge variant="outline" className="text-slate-500 border-slate-200 gap-1 font-normal">
                                    <Calendar className="w-3 h-3" />
                                    {result.registeredDate}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* CTA Banner — Growth Engine */}
                <div className="mt-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 bg-blue-100 p-2 rounded-full flex-shrink-0">
                            <UserPlus className="w-4 h-4 text-[#0B3979]" />
                        </div>
                        <div className="flex-grow">
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {t('card.notRegisteredMessage')}
                            </p>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                {t('card.notRegisteredCta')}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                <Button asChild className="bg-[#0B3979] hover:bg-[#082a5a] text-white rounded-xl shadow-md">
                                    <Link href="/for-lawyers">
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        {t('card.registerButton')}
                                    </Link>
                                </Button>
                                <Button variant="outline" className="rounded-xl border-slate-200" onClick={handleShare}>
                                    <Share2 className="w-4 h-4 mr-2" />
                                    {t('card.shareLawyer')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

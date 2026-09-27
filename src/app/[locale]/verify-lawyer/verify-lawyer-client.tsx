'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ShieldCheck, Loader2, ArrowLeft, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from '@/navigation';
import { useFirebase } from '@/firebase';
import { searchApprovedLawyersAction } from '@/app/actions/lawyer-directory-actions';
import { collection, query, where, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { useTranslations, useLocale } from 'next-intl';
import VerifyResultCard, { type VerifyResult } from '@/components/verify-result-card';
import { VerifyNoticeDialog } from './verify-notice-dialog';

// status ที่แสดงในผลค้นหา: active = มีเลขจากทะเบียน · announced = มีชื่อในประกาศรับใบอนุญาต (ไม่มีเลข)
const SEARCHABLE_STATUSES = ['active', 'announced'];

// ช่องทางตรวจสอบทางการ (สภาทนายความในพระบรมราชูปถัมภ์)
const LAWYERS_COUNCIL_URL = 'https://www.lawyerscouncil.or.th/';

// ไม่ใช้ useSearchParams — ทำให้ทั้งหน้าหลุดเป็น client render (HTML ที่ Google เห็นเหลือแค่ fallback)
// อ่าน ?licenseNumber= จาก window หลัง mount แทน
export function VerifyLawyerClient() {
    const [licenseNumberFromQuery, setLicenseNumberFromQuery] = useState<string | null>(null);
    const { firestore } = useFirebase();
    const t = useTranslations('VerifyLawyer');
    const locale = useLocale();

    const [lastUpdated, setLastUpdated] = useState<string>('');

    useEffect(() => {
        const fetchLastUpdated = async () => {
            if (!firestore) return;
            try {
                const q = query(collection(firestore, 'verifiedLawyers'), orderBy('updatedAt', 'desc'), limit(1));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    const date = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                    const dateLocale = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'th-TH';
                    const formattedDate = date.toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                    setLastUpdated(`${t('lastUpdated')} ${formattedDate}`);
                } else {
                    setLastUpdated(t('lastUpdatedToday'));
                }
            } catch (error) {
                console.error("Error fetching last updated:", error);
                setLastUpdated(t('lastUpdatedToday'));
            }
        };
        fetchLastUpdated();
    }, [firestore, t, locale]);

    const [licenseNumber, setLicenseNumber] = useState('');
    const [lawyerName, setLawyerName] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [results, setResults] = useState<VerifyResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [lawyerCount, setLawyerCount] = useState<number>(0);

    // Fetch total registry lawyer count
    useEffect(() => {
        const fetchCount = async () => {
            if (!firestore) return;
            try {
                const q = query(collection(firestore, 'verifiedLawyers'));
                const snapshot = await getCountFromServer(q);
                setLawyerCount(snapshot.data().count);
            } catch (error) {
                console.error('Error fetching lawyer count:', error);
            }
        };
        fetchCount();
    }, [firestore]);

    useEffect(() => {
        const fromQuery = new URLSearchParams(window.location.search).get('licenseNumber');
        if (fromQuery) {
            setLicenseNumber(fromQuery);
            setLicenseNumberFromQuery(fromQuery);
        }
    }, []);

    useEffect(() => {
        if (licenseNumberFromQuery && firestore) {
            handleVerify(licenseNumberFromQuery, '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [licenseNumberFromQuery, firestore]);

    const handleVerify = async (licenseInput: string = licenseNumber, nameInput: string = lawyerName) => {
        if (!firestore) return;
        if (!licenseInput && !nameInput) return;

        setIsVerifying(true);
        setResults([]);
        setHasSearched(false);

        try {
            const verifiedRef = collection(firestore, 'verifiedLawyers');

            const foundResults: VerifyResult[] = [];
            const seenLicenseNumbers = new Set<string>();

            if (licenseInput) {
                // === Search by license number ===
                // lawyerProfiles อ่านผ่าน server action แล้ว (Admin SDK + projection สาธารณะ)
                // เพราะ rules ปิด list ของ lawyerProfiles ไม่ให้ยิงจาก browser อีก
                const q2 = query(verifiedRef, where('licenseNumber', '==', licenseInput), where('status', '==', 'active'), limit(5));

                const [profileMatches, snap2] = await Promise.all([
                    searchApprovedLawyersAction({ licenseNumber: licenseInput }),
                    getDocs(q2),
                ]);

                // Lawslane registered lawyers
                profileMatches.forEach(data => {
                    const ln = data.licenseNumber;
                    seenLicenseNumbers.add(ln);
                    foundResults.push({
                        id: data.id,
                        name: data.name,
                        licenseNumber: ln,
                        status: 'active',
                        province: data.serviceProvinces?.[0] || undefined,
                        isOnLawslane: true,
                        lawslaneProfileId: data.id,
                        imageUrl: data.imageUrl,
                        specialty: data.specialty,
                        source: 'both',
                    });
                });

                // Registry-only lawyers (that are not already in Lawslane)
                snap2.docs.forEach(doc => {
                    const data = doc.data();
                    const ln = data.licenseNumber;
                    if (!seenLicenseNumbers.has(ln)) {
                        foundResults.push({
                            id: doc.id,
                            name: `${data.firstName} ${data.lastName}`,
                            licenseNumber: ln,
                            status: data.status || 'active',
                            province: data.province || undefined,
                            announcementDate: data.announcementDate || undefined,
                            sourceUrl: data.sourceUrl || undefined,
                            isOnLawslane: false,
                            source: 'registry',
                        });
                    }
                });
            } else if (nameInput) {
                // === Search by name ===
                const trimmedName = nameInput.trim();
                const names = trimmedName.split(' ').filter(Boolean);

                // 1) Search lawyerProfiles by name (ผ่าน server action — ดูหมายเหตุด้านบน)
                const profileMatches = await searchApprovedLawyersAction({ name: trimmedName });

                profileMatches.forEach(data => {
                    seenLicenseNumbers.add(data.licenseNumber);
                    foundResults.push({
                        id: data.id,
                        name: data.name,
                        licenseNumber: data.licenseNumber,
                        status: 'active',
                        province: data.serviceProvinces?.[0] || undefined,
                        isOnLawslane: true,
                        lawslaneProfileId: data.id,
                        imageUrl: data.imageUrl,
                        specialty: data.specialty,
                        source: 'both',
                    });
                });

                // 2) Search verifiedLawyers by firstName and/or lastName
                const verifiedQueries = [];

                if (names.length >= 2) {
                    // Exact firstName + lastName
                    verifiedQueries.push(
                        query(verifiedRef, where('firstName', '==', names[0]), where('lastName', '==', names.slice(1).join(' ')), where('status', 'in', SEARCHABLE_STATUSES), limit(10))
                    );
                } else {
                    // Search by firstName only
                    verifiedQueries.push(
                        query(verifiedRef, where('firstName', '==', names[0]), where('status', 'in', SEARCHABLE_STATUSES), limit(10))
                    );
                    // Also search by lastName only
                    verifiedQueries.push(
                        query(verifiedRef, where('lastName', '==', names[0]), where('status', 'in', SEARCHABLE_STATUSES), limit(10))
                    );
                }

                const verifiedSnaps = await Promise.all(verifiedQueries.map(q => getDocs(q)));

                verifiedSnaps.forEach(snap => {
                    snap.docs.forEach(doc => {
                        const data = doc.data();
                        // รายชื่อจากประกาศไม่มีเลขใบอนุญาต → กันซ้ำด้วย doc id (เดิม '' ซ้ำกันทำให้ผลหาย)
                        const ln = data.licenseNumber || '';
                        const dedupeKey = ln || `doc:${doc.id}`;
                        if (!seenLicenseNumbers.has(dedupeKey)) {
                            seenLicenseNumbers.add(dedupeKey);

                            // Cross-reference: check if this lawyer is also on Lawslane
                            // (We already checked lawyerProfiles by name above, so if licenseNumber isn't seen, they're registry-only)
                            foundResults.push({
                                id: doc.id,
                                name: `${data.firstName} ${data.lastName}`,
                                licenseNumber: ln,
                                status: data.status || 'active',
                                province: data.province || undefined,
                                announcementDate: data.announcementDate || undefined,
                                sourceUrl: data.sourceUrl || undefined,
                                isOnLawslane: false,
                                source: 'registry',
                            });
                        }
                    });
                });
            }

            // Sort: Lawslane lawyers first
            foundResults.sort((a, b) => {
                if (a.isOnLawslane && !b.isOnLawslane) return -1;
                if (!a.isOnLawslane && b.isOnLawslane) return 1;
                return 0;
            });

            setResults(foundResults);
            setHasSearched(true);
        } catch (error) {
            console.error("Verification error:", error);
            setResults([]);
            setHasSearched(true);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <>
            {/* หน้าที่มี ?licenseNumber= เป็นผลค้นหารายคน — ไม่ให้ index (middleware ส่ง X-Robots-Tag ด้วย) */}
            {licenseNumberFromQuery && <meta name="robots" content="noindex, follow" />}

            <VerifyNoticeDialog />

            {lawyerCount > 0 && (
            <p className="text-center text-sm text-slate-400 font-medium -mt-4 mb-8">
                {t('totalRegistryCount', { count: lawyerCount.toLocaleString() })}
            </p>
            )}

            {/* Search Form */}
            {!hasSearched && !isVerifying && (
            <div className="max-w-lg mx-auto mb-10">
                <Card className="shadow-xl rounded-2xl border-none overflow-hidden bg-white">
                    <CardContent className="space-y-5 p-6 md:p-8">
                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <Label htmlFor="license-number" className="text-sm font-bold text-[#0B3979]">{t('licenseNumberLabel')}</Label>
                                <div className="relative">
                                    <Input
                                        id="license-number"
                                        placeholder={t('licenseNumberPlaceholder')}
                                        value={licenseNumber}
                                        onChange={(e) => setLicenseNumber(e.target.value)}
                                        disabled={isVerifying}
                                        className="h-11 text-sm pl-10 rounded-xl border-slate-200 bg-[#F8FAFC] focus:bg-white transition-all"
                                    />
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-slate-200" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-white px-3 text-slate-400">
                                        {t('or')}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="lawyer-name" className="text-sm font-bold text-[#0B3979]">{t('lawyerNameLabel')}</Label>
                                <div className="relative">
                                    <Input
                                        id="lawyer-name"
                                        placeholder={t('lawyerNamePlaceholder')}
                                        value={lawyerName}
                                        onChange={(e) => setLawyerName(e.target.value)}
                                        disabled={isVerifying}
                                        className="h-11 text-sm pl-10 rounded-xl border-slate-200 bg-white"
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                </div>
                                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 pl-1">
                                    💡 {t('searchByNameTip')}
                                </p>
                            </div>

                            <Button
                                onClick={() => handleVerify()}
                                className="w-full h-11 rounded-full text-base font-semibold bg-[#0B3979] hover:bg-[#082a5a] text-white shadow-lg shadow-blue-900/20 transition-all"
                                size="lg"
                                disabled={isVerifying || (!licenseNumber && !lawyerName)}
                            >
                                {isVerifying ? (
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                    <Search className="mr-2 h-5 w-5" />
                                )}
                                {t('verifyButton')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* CTA: Browse registered lawyers */}
                <Link href="/lawyers" className="block mt-6 group">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B3979] to-[#1a5bb8] p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                        <div className="relative flex items-center gap-4">
                            <div className="flex-shrink-0 w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6 text-emerald-300" />
                            </div>
                            <div className="flex-grow min-w-0">
                                <p className="text-white font-semibold text-sm leading-snug">{t('ctaBrowseLawyers')}</p>
                                <p className="text-blue-200 text-xs mt-0.5">{t('ctaBrowseSubtitle')}</p>
                            </div>
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                <ArrowLeft className="w-4 h-4 text-white rotate-180 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </div>
                    </div>
                </Link>
            </div>
            )}

            {/* Loading State */}
            {isVerifying && (
                <div className="max-w-2xl mx-auto text-center text-muted-foreground bg-white p-6 rounded-2xl shadow-lg mb-8">
                    <Loader2 className="w-10 h-10 mx-auto animate-spin mb-4 text-[#0B3979]" />
                    <p className="text-lg">{t('verifying')}</p>
                </div>
            )}

            {/* Results Section */}
            {hasSearched && !isVerifying && (
                <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {results.length > 0 ? (
                        <>
                            {/* Search Again + Result Count */}
                            <div className="flex items-center justify-between px-1 mb-2">
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>{t('resultSummary', { count: results.length })}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setHasSearched(false); setResults([]); setLicenseNumber(''); setLawyerName(''); }}
                                    className="rounded-full text-sm gap-2 border-slate-200 hover:bg-blue-50 hover:text-[#0B3979]"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    {t('searchAgain')}
                                </Button>
                            </div>

                            {/* Result Cards */}
                            {results.map((result, index) => (
                                <div key={result.id} style={{ animationDelay: `${index * 100}ms` }}>
                                    <VerifyResultCard result={result} />
                                </div>
                            ))}
                        </>
                    ) : (
                        /* Not Found State */
                        <Card className="rounded-2xl border-none shadow-lg overflow-hidden">
                            <CardContent className="p-8 text-center">
                                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <AlertCircle className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('resultNotFound.title')}</h3>
                                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                                    {t('resultNotFound.description')}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Button asChild className="h-12 rounded-full bg-[#0B3979] hover:bg-[#082a5a] text-white px-8">
                                        <a href={LAWYERS_COUNCIL_URL} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            {t('resultNotFound.officialButton')}
                                        </a>
                                    </Button>
                                    <Button
                                        onClick={() => { setHasSearched(false); setLicenseNumber(''); setLawyerName(''); }}
                                        className="h-12 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 px-8"
                                    >
                                        {t('resultNotFound.closeButton')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Footer Info */}
            <div className="max-w-2xl mx-auto mt-10 pb-8">
                <div className="flex items-center justify-center space-x-4 text-slate-400 text-sm">
                    <div className="flex items-center">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        {t('dataSource')}
                    </div>
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    <div>{lastUpdated || t('loading')}</div>
                </div>
            </div>
        </>
    );
}

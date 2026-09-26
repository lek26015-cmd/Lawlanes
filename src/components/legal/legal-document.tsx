import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/navigation';
import type { LegalBlock, LegalDoc, LegalLocale } from '@/content/legal/types';
import { LEGAL_LABELS, formatLegalDate } from '@/content/legal/meta';

type LegalPage = 'terms' | 'privacy' | 'cookies' | 'aiDisclaimer';

const PAGE_HREF: Record<LegalPage, string> = {
    terms: '/terms',
    privacy: '/privacy',
    cookies: '/cookies',
    aiDisclaimer: '/ai-disclaimer',
};

// **ตัวหนา** | [ข้อความ](href) | [[ช่องที่ต้องกรอก]]
const INLINE = /\*\*(.+?)\*\*|\[\[(.+?)\]\]|\[(.+?)\]\((.+?)\)/g;

function renderInline(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    let i = 0;
    for (const m of text.matchAll(INLINE)) {
        if (m.index! > last) out.push(text.slice(last, m.index));
        const key = i++;
        if (m[1] !== undefined) {
            out.push(<strong key={key} className="font-semibold text-slate-900">{m[1]}</strong>);
        } else if (m[2] !== undefined) {
            out.push(
                <mark key={key} className="rounded bg-amber-100 px-1 text-amber-900" title="ต้องกรอกก่อนเผยแพร่">
                    {m[2]}
                </mark>
            );
        } else {
            const [label, href] = [m[3], m[4]];
            const cls = 'font-medium text-[#002f4b] underline underline-offset-2 hover:text-primary';
            out.push(
                href.startsWith('/')
                    ? <Link key={key} href={href} className={cls}>{label}</Link>
                    : <a key={key} href={href} className={cls} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{label}</a>
            );
        }
        last = m.index! + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

function Block({ block }: { block: LegalBlock }) {
    if ('p' in block) {
        return <p className="leading-relaxed text-slate-600">{renderInline(block.p)}</p>;
    }
    if ('ul' in block) {
        return (
            <ul className="list-disc space-y-2 pl-6 leading-relaxed text-slate-600 marker:text-slate-400">
                {block.ul.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
            </ul>
        );
    }
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-900">
                    <tr>
                        {block.table.head.map((h, i) => <th key={i} className="border-b border-slate-200 px-4 py-3 font-semibold">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {block.table.rows.map((row, r) => (
                        <tr key={r} className="align-top even:bg-slate-50/50">
                            {row.map((cell, c) => (
                                <td key={c} className={`border-b border-slate-100 px-4 py-3 leading-relaxed text-slate-600 ${c === 0 ? 'font-medium text-slate-800' : ''}`}>
                                    {renderInline(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function LegalDocument({
    doc,
    locale,
    icon: Icon,
    current,
}: {
    doc: LegalDoc;
    locale: LegalLocale;
    icon: LucideIcon;
    current: LegalPage;
}) {
    const labels = LEGAL_LABELS[locale];
    const related = (Object.keys(PAGE_HREF) as LegalPage[]).filter((p) => p !== current);

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="bg-gradient-to-b from-primary/10 to-transparent pb-20 pt-16 md:pt-24">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="mx-auto max-w-4xl text-center">
                        <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
                            <Icon className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="mb-3 font-headline text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                            {doc.title}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {labels.lastUpdated}: {formatLegalDate(locale)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="container mx-auto -mt-12 px-4 pb-20 md:px-6">
                <div className="mx-auto max-w-4xl space-y-6">
                    <article className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/50 md:p-12">
                        {labels.translationNote && (
                            <p className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{labels.translationNote}</p>
                        )}

                        <div className="space-y-4">
                            {doc.intro.map((p, i) => (
                                <p key={i} className="leading-relaxed text-slate-600">{renderInline(p)}</p>
                            ))}
                        </div>

                        <nav aria-label={labels.contents} className="my-8 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                            <p className="mb-3 text-sm font-semibold text-slate-900">{labels.contents}</p>
                            <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                                {doc.sections.map((s, i) => (
                                    <li key={s.id}>
                                        <a href={`#${s.id}`} className="text-slate-600 hover:text-[#002f4b] hover:underline">
                                            {i + 1}. {s.title}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        </nav>

                        <div className="space-y-10">
                            {doc.sections.map((s, i) => (
                                <section key={s.id} id={s.id} className="scroll-mt-28 space-y-4">
                                    <h2 className="text-xl font-semibold text-slate-900">
                                        {i + 1}. {s.title}
                                    </h2>
                                    {s.blocks.map((b, j) => <Block key={j} block={b} />)}
                                </section>
                            ))}
                        </div>
                    </article>

                    <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm">
                        <span className="font-semibold text-slate-900">{labels.related}:</span>{' '}
                        {related.map((p, i) => (
                            <span key={p}>
                                {i > 0 && <span className="text-slate-300"> · </span>}
                                <Link href={PAGE_HREF[p]} className="text-[#002f4b] hover:underline">{labels[p]}</Link>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * ชุดคำถามวัดผลการค้นตัวบท (recall@k ของมาตราเฉลย) — รวม 3 แหล่ง:
 *   1. ชุด OpenThai (โจทย์ร่างคำฟ้องอาญาจากข้อสอบสภาทนายความ, เฉลย = มาตราในคำขอท้ายฟ้อง)
 *      ไฟล์อยู่นอก repo (_ops/openthai-eval/data/questions.json) — ส่ง path ด้วย --openthai
 *   2. NitiBench-CCL (VISAI-AI/nitibench, MIT) — เลือกแบบคงที่ทุก ๆ N แถว เฉลย = relevant_laws
 *   3. คำถามที่ระบุเลขมาตราตรง ๆ (ทดสอบการดึงมาตราจาก metadata) — เฉลยคือมาตราที่ถามเอง
 *
 *   node scripts/rag-eval/build-set.mjs --openthai ../_ops/openthai-eval/data/questions.json [--niti=15]
 *
 * ผลลัพธ์: scripts/rag-eval/data/questions.json (gitignored — มีโจทย์ข้อสอบ ไม่ใส่ใน repo สาธารณะ)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => {
    const i = process.argv.indexOf(`--${name}`);
    if (i > 0) return process.argv[i + 1];
    return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
};

const CRIMINAL = 'ประมวลกฎหมายอาญา';
const CIVIL = 'ประมวลกฎหมายแพ่งและพาณิชย์';
const LABOUR = 'พระราชบัญญัติคุ้มครองแรงงาน พ.ศ. 2541';
const PDPA = 'พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562';

const DIRECT = [
    ['ป.พ.พ. มาตรา 1336 บัญญัติเรื่องอะไร', [[CIVIL, '1336']]],
    ['อายุความทั่วไปตามมาตรา 193/30 ประมวลกฎหมายแพ่งและพาณิชย์ กี่ปี', [[CIVIL, '193/30']]],
    ['ป.อ. มาตรา 341 ความผิดฐานฉ้อโกงมีโทษอย่างไร', [[CRIMINAL, '341']]],
    ['พ.ร.บ.คุ้มครองแรงงาน มาตรา 118 ค่าชดเชยกรณีเลิกจ้างได้เท่าไร', [[LABOUR, '118']]],
    ['ประมวลกฎหมายอาญา มาตรา 336 ทวิ เพิ่มโทษอย่างไร', [[CRIMINAL, '336ทวิ']]],
    ['ละเมิดตาม ป.พ.พ. มาตรา 420 และค่าสินไหมทดแทนตามมาตรา 438', [[CIVIL, '420'], [CIVIL, '438']]],
    ['พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล มาตรา 19 เรื่องความยินยอม', [[PDPA, '19']]],
];

const out = [];

const openthai = arg('openthai');
if (openthai) {
    const qs = JSON.parse(fs.readFileSync(openthai, 'utf8')).filter(q => q.kind === 'complaint' && q.goldOffense?.length);
    for (const q of qs) out.push({ id: q.id, set: 'openthai', question: q.question, gold: q.goldOffense.map(s => ({ law: CRIMINAL, section: s })) });
} else {
    console.warn('ไม่ได้ส่ง --openthai — ข้ามชุด OpenThai');
}

const nitiCount = Number(arg('niti') || 15);
const API = 'https://datasets-server.huggingface.co';
const info = await (await fetch(`${API}/size?dataset=VISAI-AI/nitibench`)).json();
const total = info.size.splits.find(s => s.split === 'ccl').num_rows;
const step = Math.floor(total / nitiCount);
for (let i = 0; i < nitiCount; i++) {
    const res = await fetch(`${API}/rows?dataset=VISAI-AI/nitibench&config=default&split=ccl&offset=${i * step}&length=1`);
    const row = (await res.json()).rows[0].row;
    out.push({
        id: `N-${i * step}`,
        set: 'nitibench',
        question: row.question,
        gold: row.relevant_laws.map(l => ({ law: l.law_name, section: l.section_num })),
    });
}

DIRECT.forEach(([question, gold], i) => out.push({ id: `D-${i + 1}`, set: 'direct', question, gold: gold.map(([law, section]) => ({ law, section })) }));

fs.mkdirSync(path.join(here, 'data'), { recursive: true });
fs.writeFileSync(path.join(here, 'data/questions.json'), JSON.stringify(out, null, 2));
const by = out.reduce((m, q) => ({ ...m, [q.set]: (m[q.set] || 0) + 1 }), {});
console.log(`${out.length} ข้อ`, by, '→ scripts/rag-eval/data/questions.json');

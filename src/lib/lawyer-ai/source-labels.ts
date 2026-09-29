import type { SourceType } from '@/lib/lawyer-ai/types';

// ใช้ได้ทั้ง client และ server

export function sourceType(source: string): SourceType {
    if (/^(พ\.ร\.บ\. กฤษฎีกา|ThaiLawCSV|กฎหมาย)\//.test(source)) return 'statute';
    if (source.startsWith('คำพิพากษาฎีกา')) return 'judgment';
    if (source.startsWith('ราชกิจจานุเบกษา')) return 'gazette';
    return 'other';
}

// ชื่อไฟล์ในฐานข้อมูลเป็นเลข (เช่น "พ.ร.บ. กฤษฎีกา/3117.json") — ใช้เมื่อหาชื่อกฎหมายไม่ได้
export function sourceLabel(source: string): string {
    const csv = source.match(/^ThaiLawCSV\/([^/]+)\/(.+)$/);
    if (csv) return csv[2] === 'null' ? csv[1] : `${csv[1]} มาตรา ${csv[2]}`;
    const judgment = source.match(/^คำพิพากษาฎีกา\/(?:.*\/)?([^/]+?)(?:\.(?:pdf|json|txt))?$/i);
    // ไฟล์บางชุดตั้งชื่อเป็นเลขหน้า (p127) ไม่ใช่เลขฎีกา — อย่าแสดงเหมือนเป็นเลขฎีกา
    if (judgment && /^p\d+$/i.test(judgment[1])) return 'คำพิพากษาฎีกา (ไม่ระบุเลขที่)';
    if (judgment && !/^[\d-]+$/.test(judgment[1])) return `คำพิพากษาฎีกา ${judgment[1]}`;
    const file = source.split('/').pop()?.replace(/\.(pdf|json|txt)$/i, '') || '';
    return /^[\d-]+$/.test(file) ? 'เอกสารกฎหมาย' : file || 'เอกสารกฎหมาย';
}

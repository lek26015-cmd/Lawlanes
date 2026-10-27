/**
 * แจ้งเจ้าของระบบผ่าน LINE ของ "ลลิน" (Lalin_Assistant) — push ไปหา OWNER_LINE_ID ของบอทนั้นตรงๆ
 *
 * ต้องตั้ง env ฝั่ง server (ห้าม hardcode — repo เป็น public):
 *   LALIN_LINE_CHANNEL_ACCESS_TOKEN = LINE_CHANNEL_ACCESS_TOKEN ของ Lalin_Assistant
 *   LALIN_OWNER_LINE_ID             = OWNER_LINE_ID ของ Lalin_Assistant
 * (userId ของ LINE ผูกกับ provider จึงต้องใช้ค่าคู่กับ channel ของลลินเท่านั้น)
 * ไม่ได้ตั้งค่า = ข้ามเงียบๆ
 *
 * ห้ามใส่เนื้อข้อความแชท — แชทเป็น E2EE และไม่ควรส่งเนื้อคดีออกไปนอกระบบ
 */
export async function notifyOwnerViaLalin(text: string): Promise<void> {
    const token = process.env.LALIN_LINE_CHANNEL_ACCESS_TOKEN;
    const to = process.env.LALIN_OWNER_LINE_ID;
    if (!token || !to) return;

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
        throw new Error(`Lalin LINE push failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
}

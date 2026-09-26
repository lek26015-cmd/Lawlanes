// ทดสอบ firestore.rules ส่วนบริการล่ามกับ Firestore emulator (ต้องมี Java)
// รันจากโฟลเดอร์ Lawslane:
//   npx firebase emulators:exec --only firestore --project demo-interpreter \
//     "node scripts/tests/interpreter-rules.test.mjs"
// (emulator ค่าเริ่มต้นอยู่ที่ 127.0.0.1:8080 — ตั้ง FIRESTORE_EMULATOR_PORT ถ้าใช้ port อื่น)
// ใช้ project demo-* เท่านั้น → ไม่แตะ Firebase production
const HOST = `http://127.0.0.1:${process.env.FIRESTORE_EMULATOR_PORT || 8080}`;
const PROJECT = 'demo-interpreter';
const BASE = `${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (uid, extra = {}) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, user_id: uid, iat: 0, exp: 9999999999, aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, auth_time: 0, firebase: { sign_in_provider: 'custom' }, ...extra })}.`;
const headers = auth => ({ 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) });
const fields = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: v } : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }])) });

async function seed(path, data) {
  const r = await fetch(`${BASE}/${path}`, { method: 'PATCH', headers: headers('owner'), body: JSON.stringify(fields(data)) });
  if (!r.ok) throw new Error(`seed ${path}: ${r.status} ${await r.text()}`);
}
const get = (path, auth) => fetch(`${BASE}/${path}`, { headers: headers(auth) }).then(r => r.status);
const write = (path, auth, data) => fetch(`${BASE}/${path}`, { method: 'PATCH', headers: headers(auth), body: JSON.stringify(fields(data)) }).then(r => r.status);
const list = (col, auth) => fetch(`${BASE}/${col}`, { headers: headers(auth) }).then(r => r.status);

const cases = [];
const expect = (name, actual, ok) => cases.push({ name, actual, pass: ok ? actual === 200 : actual === 403 });

await seed('interpreterProfiles/interp1', { userId: 'interp1', name: 'A', status: 'approved' });
await seed('interpreterProfiles/interp1/private/details', { bankAccountNumber: '1234567890' });
await seed('interpreterBookings/b1', { customerId: 'cust1', interpreterId: 'interp1', status: 'paid' });
await seed('interpreterSlots/interp1_20261005_09', { bookingId: 'b1', interpreterId: 'interp1' });
await seed('interpreterPayouts/p1', { interpreterId: 'interp1', totalNet: 100 });
await seed('settings/interpreterFees', { gpPercent: 15 });
await seed('interpreterConversations/cust1_interp1', { customerId: 'cust1', interpreterUserId: 'interp1' });
await seed('interpreterConversations/cust1_interp1/messages/m1', { text: 'x', originalText: '0812345678' });
await seed('interpreterBookings/b1/private/contact', { phone: '0812345678' });

const anon = null, stranger = jwt('stranger'), cust = jwt('cust1'), interp = jwt('interp1'), adminTok = jwt('adm', { admin: true });

expect('anon get profile', await get('interpreterProfiles/interp1', anon), false);
expect('stranger get profile', await get('interpreterProfiles/interp1', stranger), false);
expect('owner get profile', await get('interpreterProfiles/interp1', interp), true);
expect('stranger list profiles', await list('interpreterProfiles', stranger), false);
expect('owner write profile (status)', await write('interpreterProfiles/interp1?updateMask.fieldPaths=status', interp, { status: 'approved' }), false);
expect('stranger create profile', await write('interpreterProfiles/stranger', stranger, { status: 'approved' }), false);
expect('stranger read private', await get('interpreterProfiles/interp1/private/details', stranger), false);
expect('owner read private', await get('interpreterProfiles/interp1/private/details', interp), true);
expect('owner write private', await write('interpreterProfiles/interp1/private/details', interp, { bankAccountNumber: '999' }), false);
expect('customer get booking', await get('interpreterBookings/b1', cust), true);
expect('interpreter get booking', await get('interpreterBookings/b1', interp), true);
expect('stranger get booking', await get('interpreterBookings/b1', stranger), false);
expect('customer write booking status', await write('interpreterBookings/b1?updateMask.fieldPaths=status', cust, { status: 'completed' }), false);
expect('interpreter write booking payout', await write('interpreterBookings/b1?updateMask.fieldPaths=payoutStatus', interp, { payoutStatus: 'due' }), false);
expect('customer read slot', await get('interpreterSlots/interp1_20261005_09', cust), false);
expect('stranger create slot', await write('interpreterSlots/x', stranger, { bookingId: 'z' }), false);
expect('interpreter get own payout', await get('interpreterPayouts/p1', interp), true);
expect('stranger get payout', await get('interpreterPayouts/p1', stranger), false);
expect('interpreter write payout', await write('interpreterPayouts/p2', interp, { interpreterId: 'interp1', totalNet: 1 }), false);
expect('signed-in read gp setting', await get('settings/interpreterFees', stranger), true);
expect('stranger write gp setting', await write('settings/interpreterFees', stranger, { gpPercent: 0 }), false);
expect('admin write gp setting', await write('settings/interpreterFees', adminTok, { gpPercent: 20 }), true);
expect('admin get private', await get('interpreterProfiles/interp1/private/details', adminTok), true);

expect('customer read own conversation doc', await get('interpreterConversations/cust1_interp1', cust), false);
expect('interpreter read messages (original text)', await get('interpreterConversations/cust1_interp1/messages/m1', interp), false);
expect('customer write message directly', await write('interpreterConversations/cust1_interp1/messages/m2', cust, { text: 'hi' }), false);
expect('interpreter read customer contact before server unlock', await get('interpreterBookings/b1/private/contact', interp), false);
expect('admin read messages', await get('interpreterConversations/cust1_interp1/messages/m1', adminTok), true);

for (const c of cases) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name} → ${c.actual}`);
const failed = cases.filter(c => !c.pass).length;
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);

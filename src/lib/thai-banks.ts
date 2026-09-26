// ธนาคารไทย + โลโก้ (src/pic/logo-bank) — ใช้ร่วมกันทุกฟอร์มบัญชีรับเงิน
// value ที่บันทึกคือชื่อธนาคารภาษาไทย (ข้อมูลทนายเดิมเก็บแบบนี้)
import bblLogo from '@/pic/logo-bank/กรุงเทพ.png';
import kbankLogo from '@/pic/logo-bank/กสิกร.png';
import ktbLogo from '@/pic/logo-bank/กรุงไทย.png';
import scbLogo from '@/pic/logo-bank/ไทยพาณิช.png';
import bayLogo from '@/pic/logo-bank/กรุงศรี.png';
import ttbLogo from '@/pic/logo-bank/ttb.png';
import gsbLogo from '@/pic/logo-bank/ออมสิน.png';
import baacLogo from '@/pic/logo-bank/ธนาคาร ธกส.png';
import cimbLogo from '@/pic/logo-bank/Cimb.png';
import uobLogo from '@/pic/logo-bank/UOB.png';
import tiscoLogo from '@/pic/logo-bank/ทิสโก้.png';
import ibankLogo from '@/pic/logo-bank/ธนาคารอิสลาม.png';
import ghbLogo from '@/pic/logo-bank/ธอส.png';
import kkpLogo from '@/pic/logo-bank/เกียรตินาคิน.png';
import lhLogo from '@/pic/logo-bank/แลนด์แลนด์เฮ้าท์ .png';
import icbcLogo from '@/pic/logo-bank/ICBC.png';
import bocLogo from '@/pic/logo-bank/ธนาคารแห่งประเทศจีน.png';

export const THAI_BANKS = [
  { name: "ธนาคารกรุงเทพ", logo: bblLogo, color: "#1e4598" },
  { name: "ธนาคารกสิกรไทย", logo: kbankLogo, color: "#138f2d" },
  { name: "ธนาคารกรุงไทย", logo: ktbLogo, color: "#1ba5e1" },
  { name: "ธนาคารไทยพาณิชย์", logo: scbLogo, color: "#4e2e7f" },
  { name: "ธนาคารกรุงศรีอยุธยา", logo: bayLogo, color: "#fec43b" },
  { name: "ธนาคารทหารไทยธนชาต", logo: ttbLogo, color: "#102a4d" },
  { name: "ธนาคารออมสิน", logo: gsbLogo, color: "#eb198d" },
  { name: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", logo: baacLogo, color: "#4b9b1d" },
  { name: "ธนาคารซีไอเอ็มบี ไทย", logo: cimbLogo, color: "#7e2f36" },
  { name: "ธนาคารยูโอบี", logo: uobLogo, color: "#0b3979" },
  { name: "ธนาคารทิสโก้", logo: tiscoLogo, color: "#1a4d8d" },
  { name: "ธนาคารอิสลามแห่งประเทศไทย", logo: ibankLogo, color: "#164134" },
  { name: "ธนาคารอาคารสงเคราะห์", logo: ghbLogo, color: "#f58523" },
  { name: "ธนาคารเกียรตินาคินภัทร", logo: kkpLogo, color: "#6e5a9c" },
  { name: "ธนาคารแลนด์ แอนด์ เฮ้าส์", logo: lhLogo, color: "#6d6e71" },
  { name: "ธนาคารไอซีบีซี (ไทย)", logo: icbcLogo, color: "#c4161c" },
  { name: "ธนาคารแห่งประเทศจีน (ไทย)", logo: bocLogo, color: "#b40026" },
] as const;

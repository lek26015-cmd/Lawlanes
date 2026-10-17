#!/usr/bin/env python3
"""
Ingest ตัวบทกฎหมายแบบ "หนึ่ง vector ต่อหนึ่งมาตรา" เข้า Vectorize index ใหม่ (lawslane-sections)
ผ่าน worker /ingest-sections — index เดิม (lawslane-index) ไม่ถูกแตะ

แหล่งข้อมูล (ทั้งคู่เป็นข้อมูลเปิด):
  1. VISAI-AI/nitibench-statute (MIT) — 35 ฉบับ รายมาตรา รวม ป.พ.พ. ครบทุกบรรพ และประมวลรัษฎากร
  2. open-law-data-thailand/ocs-krisdika — ฉบับรวมล่าสุดของแต่ละกฎหมาย (law_code) ที่ไม่มีในชุด 1
     ชุดนี้มีทุกฉบับแก้ไขเป็นไฟล์แยก (ที่มาของ chunk ซ้ำใน index เดิม) จึงเลือกแค่ timeline ล่าสุดที่เป็นฉบับรวม
     ป.พ.พ. ในชุดนี้มีแค่บรรพ 1-2 จึงใช้ชุด 1 แทน

id ของแต่ละ vector = sha256("sec|{law_id}|{section}|{part}")[:32] — worker คำนวณแบบเดียวกันเพื่อดึงมาตราตรง ๆ
(ต้องตรงกับ sectionId() ใน workers/rag-api/src/sections.ts)

  python3 scripts/ingest-sections.py --plan          # สร้าง workers/rag-api/src/laws.json + สรุปจำนวน ไม่ส่งข้อมูล
  python3 scripts/ingest-sections.py [--start N]     # ส่งเข้า worker (ต้องตั้ง RAG_INGEST_KEY)

ต้องมี: pip install huggingface_hub pyarrow requests
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

WORKER_URL = os.environ.get("RAG_WORKER_URL", "https://lawslane-rag-api.lawlanes-app.workers.dev")
ROOT = Path(__file__).resolve().parent.parent
LAWS_JSON = ROOT / "workers/rag-api/src/laws.json"
BATCH = 50
# bge-m3 รับไม่เกิน 60,000 token ต่อครั้ง โดยนับแบบ padding (จำนวนข้อความ × ข้อความที่ยาวที่สุด)
# และบางฉบับ ~1 token ต่อตัวอักษร — จำกัด จำนวน × ความยาวสูงสุด ต่อ batch
BATCH_CHARS = 40_000
# metadata ของ Vectorize จำกัด 10 KiB ต่อ vector — ภาษาไทย 3 ไบต์/ตัวอักษร จึงแบ่งมาตรายาวเป็นหลาย part
MAX_PART_CHARS = 2800

THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙"
SECTION_NO = re.compile(r"^\d+(?:/\d+)?(?:\s*[ก-๙]+)?$")


def to_arabic(s: str) -> str:
    return "".join(str(THAI_DIGITS.index(c)) if c in THAI_DIGITS else c for c in s)


def norm_section(raw: str) -> str | None:
    s = to_arabic(str(raw)).strip()
    if not SECTION_NO.match(s) or s.startswith("ฉบับ"):
        return None  # "ฉบับที่ 9" (บทเฉพาะกาลของฉบับแก้ไข), "พรฎ" ฯลฯ ไม่ใช่มาตราของตัวกฎหมาย
    return re.sub(r"\s+", "", s)


def section_id(law_id: str, section: str, part: int) -> str:
    return hashlib.sha256(f"sec|{law_id}|{section}|{part}".encode()).hexdigest()[:32]


def split_parts(text: str) -> list[str]:
    if len(text) <= MAX_PART_CHARS:
        return [text]
    parts, cur = [], ""
    for para in text.split("\n"):
        while len(para) > MAX_PART_CHARS:  # ย่อหน้าเดียวยาวเกิน — ตัดตรง ๆ
            if cur:
                parts.append(cur)
                cur = ""
            parts.append(para[:MAX_PART_CHARS])
            para = para[MAX_PART_CHARS:]
        if len(cur) + len(para) + 1 > MAX_PART_CHARS:
            parts.append(cur)
            cur = para
        else:
            cur = f"{cur}\n{para}" if cur else para
    if cur:
        parts.append(cur)
    return parts


def be_year(name: str) -> int | None:
    m = re.search(r"พ\.ศ\.\s*([0-9๐-๙]{4})", name)
    return int(to_arabic(m.group(1))) - 543 if m else None


def load_nitibench() -> list[dict]:
    from huggingface_hub import hf_hub_download
    import pyarrow.parquet as pq

    path = hf_hub_download("VISAI-AI/nitibench-statute", "data/ccl-00000-of-00001.parquet", repo_type="dataset")
    rows = pq.read_table(path).to_pylist()
    out = []
    for r in rows:
        section = norm_section(r["section_num"])
        if not section:
            continue
        # เนื้อหาขึ้นต้นด้วยชื่อกฎหมายซ้ำ — ตัดออกให้เริ่มที่ "มาตรา"
        text = r["section_content"].strip()
        if text.startswith(r["law_name"]):
            text = text[len(r["law_name"]):].strip()
        out.append({"law_id": r["law_code"], "law_name": r["law_name"], "section": section, "text": text,
                    "dataset": "nitibench"})
    return out


def load_krisdika(skip_law_ids: set[str]) -> tuple[list[dict], dict[str, dict]]:
    from huggingface_hub import snapshot_download

    base = snapshot_download("open-law-data-thailand/ocs-krisdika", repo_type="dataset", allow_patterns=["data/*/*.jsonl"])
    best: dict[str, dict] = {}
    for f in sorted(glob.glob(f"{base}/data/*/*.jsonl")):
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                r = json.loads(line)
                if not any(s.get("sectionNo") for s in r.get("sections", [])):
                    continue
                # ฉบับรวม (ชื่อไม่มี "(ฉบับที่ n)") ชนะฉบับแก้ไข แล้วค่อยดู timeline ล่าสุด
                rank = ("(ฉบับที่" not in r["title"], r["timeline_code"])
                cur = best.get(r["law_code"])
                if not cur or rank > cur["_rank"]:
                    r["_rank"] = rank
                    best[r["law_code"]] = r
    out = []
    meta = {}
    for law_id, r in best.items():
        meta[law_id] = {"name": r["title"].strip(), "year": int(r["publish_date"][:4]) if r.get("publish_date") else None}
        if law_id in skip_law_ids:
            continue
        # รวมย่อหน้า (contentNo) ของ sectionId เดียวกันเป็นหนึ่งมาตรา
        order, by_sid = [], {}
        for s in r["sections"]:
            sec = norm_section(s["sectionNo"]) if s.get("sectionNo") else None
            if not sec:
                continue
            if s["sectionId"] not in by_sid:
                by_sid[s["sectionId"]] = {"section": sec, "paras": []}
                order.append(s["sectionId"])
            by_sid[s["sectionId"]]["paras"].append(s["content"].strip())
        for sid in order:
            item = by_sid[sid]
            out.append({"law_id": law_id, "law_name": meta[law_id]["name"], "section": item["section"],
                        "text": "\n".join(p for p in item["paras"] if p), "year": meta[law_id]["year"],
                        "dataset": "krisdika"})
    return out, meta


def build_items(sections: list[dict]) -> list[dict]:
    # ประมวลฯ มี "มาตรา 1-3" ของ พ.ร.บ. ให้ใช้ประมวลฯ นำหน้า แล้วค่อยเป็นมาตรา 1 ของตัวประมวล — เลขซ้ำในฉบับเดียวกัน
    # ให้ตัวหลังสุด (ตัวประมวลเอง) ได้ id หลัก ตัวก่อนหน้าได้ "~k" (ยังค้นด้วยความหมายเจอ แต่ไม่ถูกดึงแบบตรงเลข)
    last_index = {}
    for i, s in enumerate(sections):
        last_index[(s["law_id"], s["section"])] = i
    seen_count: dict[tuple, int] = {}
    items = []
    for i, s in enumerate(sections):
        key = (s["law_id"], s["section"])
        if last_index[key] == i:
            id_section = s["section"]
        else:
            seen_count[key] = seen_count.get(key, 0) + 1
            id_section = f"{s['section']}~{seen_count[key]}"
        parts = split_parts(s["text"])
        for p, text in enumerate(parts):
            md = {"law_id": s["law_id"], "law_name": s["law_name"], "section": s["section"], "text": text,
                  "part": p, "parts": len(parts), "dataset": s["dataset"],
                  "source": f"ตัวบท/{s['law_name']}/มาตรา {s['section']}"}
            if s.get("year"):
                md["year"] = s["year"]
            items.append({"id": section_id(s["law_id"], id_section, p), "metadata": md,
                          "embedText": f"{s['law_name']} มาตรา {s['section']}\n{text}"})
    return items


def post_batch(batch: list[dict], key: str) -> None:
    for attempt in range(12):
        try:
            res = requests.post(f"{WORKER_URL}/ingest-sections", json={"items": batch},
                                headers={"Authorization": f"Bearer {key}"}, timeout=120)
            if res.ok:
                return
            if "4006" in res.text:
                # โควตา Workers AI รายวันหมด — production ใช้โควตาเดียวกัน หยุดทันที ไม่ยิงซ้ำ
                os._exit(3)
            print(f"  ⚠️ {res.status_code} {res.text[:200]}", file=sys.stderr)
        except requests.RequestException as e:
            print(f"  ⚠️ {e}", file=sys.stderr)
        time.sleep(min(2 ** attempt, 60))
    raise SystemExit("ingest failed repeatedly — rerun with --start to resume")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", action="store_true", help="สร้าง laws.json และสรุปจำนวนเท่านั้น")
    ap.add_argument("--start", type=int, default=0, help="เริ่มจาก item ที่ N (resume)")
    ap.add_argument("--workers", type=int, default=6, help="จำนวน batch ที่ส่งพร้อมกัน")
    # แพลนฟรีของ Workers AI ได้ 10,000 neurons/วัน ใช้ร่วมกับ production (~1.5 neurons ต่อมาตรา)
    # ใช้ --max-items แบ่งส่งทีละวัน ให้เหลือโควตาไว้ให้ /query ของ production
    ap.add_argument("--max-items", type=int, default=0, help="ส่งไม่เกิน N item ในรอบนี้ (0 = ทั้งหมด)")
    ap.add_argument("--progress", help="ไฟล์เก็บตำแหน่งที่ส่งครบแล้ว (ใช้เป็น --start รอบถัดไป)")
    args = ap.parse_args()

    niti = load_nitibench()
    niti_ids = {s["law_id"] for s in niti}
    kd, kd_meta = load_krisdika(niti_ids)
    for s in niti:
        s["year"] = (kd_meta.get(s["law_id"]) or {}).get("year") or be_year(s["law_name"])
    sections = niti + kd

    laws = {}
    for s in sections:
        laws.setdefault(s["law_id"], {"id": s["law_id"], "name": s["law_name"], **({"year": s["year"]} if s.get("year") else {})})
    LAWS_JSON.write_text(json.dumps(sorted(laws.values(), key=lambda x: x["id"]), ensure_ascii=False, separators=(",", ":")) + "\n")

    items = build_items(sections)
    print(f"laws {len(laws)} · sections {len(sections)} (nitibench {len(niti)}, krisdika {len(kd)}) · vectors {len(items)}")
    print(f"→ {LAWS_JSON.relative_to(ROOT)}")
    if args.plan:
        return

    key = os.environ.get("RAG_INGEST_KEY", "")
    if not key:
        raise SystemExit("RAG_INGEST_KEY is not set")
    from concurrent.futures import ThreadPoolExecutor

    t0 = time.time()
    batches, cur, longest = [], [], 0
    stop = min(len(items), args.start + args.max_items) if args.max_items else len(items)
    for i in range(args.start, stop):
        n = len(items[i]["embedText"])
        if cur and (len(cur) >= BATCH or (len(cur) + 1) * max(longest, n) > BATCH_CHARS):
            batches.append(cur)
            cur, longest = [], 0
        cur.append(i)
        longest = max(longest, n)
    if cur:
        batches.append(cur)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        # map คืนผลตามลำดับ — ถ้าล้มกลางทาง ตัวเลขที่พิมพ์ล่าสุดคือจุด --start ที่ปลอดภัย
        send = lambda b: (post_batch([items[i] for i in b], key), b[-1] + 1)[1]
        for n, end in enumerate(pool.map(send, batches)):
            if args.progress:
                Path(args.progress).write_text(str(end))
            if n % 20 == 0 or end == stop:
                rate = (end - args.start) / max(time.time() - t0, 1)
                print(f"  {end}/{len(items)} · {rate:.0f}/s", flush=True)
    print("🎉 done" if stop == len(items) else f"⏸ paused at {stop} — rerun with --start {stop}")


if __name__ == "__main__":
    main()

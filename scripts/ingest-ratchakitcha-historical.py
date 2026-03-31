#!/usr/bin/env python3
"""
Ingest Ratchakitcha (Royal Gazette) OCR data from HuggingFace into Cloudflare Vectorize.
BACKWARDS version: Processes years from END_YEAR down to START_YEAR.
"""
from __future__ import annotations

import json
import hashlib
import time
import sys
import os
import requests
from typing import Optional, List, Tuple
from pathlib import Path

# Config
WORKER_URL = "https://lawslane-rag-api.lawlanes-app.workers.dev"
LOCAL_API_URL = "http://localhost:9002/api/admin/ingestion-status"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
DELAY_BETWEEN_CHUNKS = 0.5 

# Years to ingest (Historical starting from B.E. 2475)
START_YEAR = 1932
END_YEAR = 2019
CHECKPOINT_FILE = "scripts/checkpoint-historical.json"

def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r') as f:
                data = json.load(f)
                return data["year"], data["month"]
        except Exception:
            pass
    return END_YEAR, 12

def save_checkpoint(year, month):
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump({"year": year, "month": month}, f)

def update_local_status(status: str, message: str = "", next_retry: str = ""):
    try:
        requests.post(
            LOCAL_API_URL,
            json={"task": "historical", "status": status, "message": message, "nextRetry": next_retry},
            timeout=5
        )
    except Exception:
        pass

def download_jsonl(year: int, month: int) -> Optional[str]:
    from huggingface_hub import hf_hub_download
    month_str = f"{year}-{month:02d}"
    try:
        path = hf_hub_download(
            "open-law-data-thailand/soc-ratchakitcha",
            f"ocr/iapp/{year}/{month_str}.jsonl",
            repo_type="dataset",
        )
        return path
    except Exception as e:
        if "404" not in str(e):
            print(f"  ⚠️ Could not download {month_str}.jsonl: {e}")
        return None

def extract_text_from_record(record: dict) -> str:
    if not record.get("success") or not record.get("data"):
        return ""
    ocr_results = record["data"].get("ocr_results", [])
    pages = []
    for page in ocr_results:
        text = page.get("markdown_output", "").strip()
        if text:
            pages.append(text)
    return "\n\n".join(pages)

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def ingest_chunk(text: str, metadata: dict) -> bool:
    max_retries = 1000
    base_wait = 2
    max_wait = 3600
    for attempt in range(max_retries):
        try:
            update_local_status("active", f"Ingesting historical {metadata.get('source', 'unknown')}")
            response = requests.post(
                f"{WORKER_URL}/ingest",
                json={"text": text, "metadata": metadata, "id": metadata["id"]},
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            if response.status_code == 429:
                wait_time = min(base_wait * (2 ** attempt), max_wait)
                time.sleep(wait_time)
                continue
            if not response.ok:
                time.sleep(10)
                continue
            return True
        except Exception:
            time.sleep(10)
    return False

def process_jsonl_file(filepath: str, year: int, month: int) -> Tuple[int, int]:
    total_chunks = 0
    successful_chunks = 0
    with open(filepath, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f):
            try:
                record = json.loads(line.strip())
            except json.JSONDecodeError:
                continue
            pdf_file = record.get("pdf_file", f"unknown-{line_num}")
            text = extract_text_from_record(record)
            if not text or len(text) < 50:
                continue
            chunks = chunk_text(text)
            for i, chunk in enumerate(chunks):
                chunk_id = hashlib.md5(f"rk-hist-{pdf_file}-{i}".encode()).hexdigest()
                metadata = {
                    "id": chunk_id,
                    "source": f"ราชกิจจานุเบกษา(Hist)/{pdf_file}",
                    "text": chunk,
                    "year": year,
                    "month": month,
                    "chunkIndex": i,
                    "totalChunks": len(chunks),
                    "dataset": "ratchakitcha",
                }
                total_chunks += 1
                if ingest_chunk(chunk, metadata):
                    successful_chunks += 1
                time.sleep(DELAY_BETWEEN_CHUNKS)
            if (line_num + 1) % 10 == 0:
                print(f"    📄 Processed {line_num + 1} documents...")
    return total_chunks, successful_chunks

def main():
    print(f"📜 Ratchakitcha Historical Ingestion (BACKWARDS) — Years {END_YEAR} to {START_YEAR}")
    current_year, current_month = load_checkpoint()
    
    while current_year >= START_YEAR:
        print(f"📅 Year {current_year}")
        while current_month >= 1:
            month_str = f"{current_year}-{current_month:02d}"
            filepath = download_jsonl(current_year, current_month)
            if filepath:
                print(f"  ⚙️  Processing {month_str}...")
                total, success = process_jsonl_file(filepath, current_year, current_month)
                print(f"  ✅ {month_str}: {success}/{total} chunks ingested")
            
            current_month -= 1
            if current_month >= 1:
                save_checkpoint(current_year, current_month)
            else:
                break
                
        current_year -= 1
        current_month = 12
        if current_year >= START_YEAR:
            save_checkpoint(current_year, current_month)

    print(f"🎉 Ingestion complete!")
    update_local_status("idle", "Historical ingestion complete")

if __name__ == "__main__":
    main()

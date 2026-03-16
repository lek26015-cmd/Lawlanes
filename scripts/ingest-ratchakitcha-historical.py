#!/usr/bin/env python3
"""
Ingest Ratchakitcha (Royal Gazette) OCR data from HuggingFace into Cloudflare Vectorize.
Downloads JSONL files for the specified year range, chunks the text,
and sends each chunk to the Cloudflare Worker /ingest endpoint.
Specialized for Historical 2010-2019 batch.
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

# Years to ingest (Historical)
START_YEAR = 2010
END_YEAR = 2019

def update_local_status(status: str, message: str = "", next_retry: str = ""):
    """Notify the local Next.js API about the current ingestion status."""
    try:
        requests.post(
            LOCAL_API_URL,
            json={"task": "historical", "status": status, "message": message, "nextRetry": next_retry},
            timeout=5
        )
    except Exception:
        pass


def download_jsonl(year: int, month: int) -> Optional[str]:
    """Download a single JSONL file from HuggingFace."""
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
    """Extract all page text from an OCR record."""
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
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def ingest_chunk(text: str, metadata: dict) -> bool:
    """Send a single chunk to the Cloudflare Worker with ultra-resilient infinite retries."""
    max_retries = 1000  # Practically infinite for autonomous running
    base_wait = 2
    max_wait = 3600    # Cap wait at 1 hour
    
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
                print(f"    ⚠️ Rate limited (429). Retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})")
                update_local_status("cooling_down", f"Hit rate limit. Cooling down for {wait_time}s", f"{wait_time}s")
                time.sleep(wait_time)
                continue
                
            if not response.ok:
                print(f"    ❌ Ingest failed: {response.status_code} {response.text[:100]}")
                if response.status_code >= 500:
                    wait_time = min(base_wait * (2 ** attempt), max_wait)
                    update_local_status("cooling_down", f"Server error {response.status_code}. Retrying...", f"{wait_time}s")
                    time.sleep(wait_time)
                    continue
                
                # For non-retriable fatal errors, log and try one more time after a long rest
                print(f"    🚫 Non-retriable error {response.status_code}. Resting for 10 mins...")
                update_local_status("error", f"Fatal error {response.status_code}. Resting.")
                time.sleep(600)
                continue
                
            return True
        except Exception as e:
            wait_time = min(base_wait * (2 ** attempt), max_wait)
            print(f"    ❌ Ingest error: {e}. Retrying in {wait_time}s...")
            update_local_status("cooling_down", f"Network error. Waiting {wait_time}s", f"{wait_time}s")
            time.sleep(wait_time)
            
    print("    🛑 Ultra-max retries reached for this chunk. Resting for 1 hour to cool system...")
    update_local_status("error", "Max retries reached. Resting 1h.")
    time.sleep(3600)
    return False


def process_jsonl_file(filepath: str, year: int, month: int) -> Tuple[int, int]:
    """Process a single JSONL file and ingest all records."""
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
    print(f"📜 Ratchakitcha Historical Ingestion — Years {START_YEAR}-{END_YEAR}")
    print()
    
    grand_total = 0
    grand_success = 0
    
    for year in range(START_YEAR, END_YEAR + 1):
        print(f"📅 Year {year}")
        for month in range(1, 13):
            month_str = f"{year}-{month:02d}"
            filepath = download_jsonl(year, month)
            if not filepath:
                continue
            
            print(f"  ⚙️  Processing {month_str}...")
            total, success = process_jsonl_file(filepath, year, month)
            grand_total += total
            grand_success += success
            print(f"  ✅ {month_str}: {success}/{total} chunks ingested")
        
    print(f"🎉 Ingestion complete! Total: {grand_success}/{grand_total}")
    update_local_status("idle", "Historical ingestion complete")


if __name__ == "__main__":
    main()

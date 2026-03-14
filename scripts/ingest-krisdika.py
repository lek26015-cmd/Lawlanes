#!/usr/bin/env python3
"""
Ingest Krisdika (Council of State) Acts data from HuggingFace into Cloudflare Vectorize.
Downloads JSONL files for the specified year range, chunks the text,
and sends each chunk to the Cloudflare Worker /ingest endpoint.
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

WORKER_URL = "https://lawslane-rag-api.lawlanes-app.workers.dev"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
DELAY_BETWEEN_CHUNKS = 0.15  # seconds

# Years to ingest (Krisdika goes back very far)
START_YEAR = 1877
END_YEAR = 2025

def download_jsonl(year: int, month: int) -> Optional[str]:
    """Download a single JSONL file from HuggingFace."""
    from huggingface_hub import hf_hub_download
    
    month_str = f"{year}-{month:02d}"
    try:
        path = hf_hub_download(
            "open-law-data-thailand/ocs-krisdika",
            f"data/{year}/{month_str}.jsonl",
            repo_type="dataset",
        )
        return path
    except Exception as e:
        # Many months/years may not have data, this is normal.
        if "Entry not found" not in str(e) and "404 Client Error" not in str(e):
            print(f"  ⚠️ Error downloading {month_str}.jsonl: {e}")
        return None


def extract_text_from_record(record: dict) -> str:
    """Extract law title and all section contents from a Krisdika record."""
    title = record.get("title", "").strip()
    sections = record.get("sections", [])
    
    text_parts = [title]
    
    for sec in sections:
        content = sec.get("content", "").strip()
        if content:
            text_parts.append(content)
            
    return "\n\n".join([p for p in text_parts if p])


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
    """Send a single chunk to the Cloudflare Worker."""
    try:
        response = requests.post(
            f"{WORKER_URL}/ingest",
            json={"text": text, "metadata": metadata, "id": metadata["id"]},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        if not response.ok:
            print(f"    ❌ Ingest failed: {response.status_code} {response.text[:100]}")
            return False
        return True
    except Exception as e:
        print(f"    ❌ Ingest error: {e}")
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
            
            filename = record.get("filename", f"krisdika-{line_num}")
            category = record.get("category", "Unknown")
            is_latest = record.get("is_latest", True)
            
            text = extract_text_from_record(record)
            
            if not text or len(text) < 50:
                continue
            
            chunks = chunk_text(text)
            
            for i, chunk in enumerate(chunks):
                chunk_id = hashlib.md5(f"kd-{filename}-{i}".encode()).hexdigest()
                metadata = {
                    "id": chunk_id,
                    "source": f"พ.ร.บ. กฤษฎีกา/{filename}",
                    "text": chunk,
                    "year": year,
                    "month": month,
                    "category": category,
                    "is_latest": is_latest,
                    "chunkIndex": i,
                    "totalChunks": len(chunks),
                    "dataset": "krisdika",
                }
                
                total_chunks += 1
                if ingest_chunk(chunk, metadata):
                    successful_chunks += 1
                
                time.sleep(DELAY_BETWEEN_CHUNKS)
            
            # Print progress every 10 documents
            if (line_num + 1) % 10 == 0:
                print(f"    📄 Processed {line_num + 1} documents...")
    
    return total_chunks, successful_chunks


def main():
    print(f"⚖️ Krisdika Apps Ingestion — Years {START_YEAR}-{END_YEAR}")
    print(f"   Worker: {WORKER_URL}")
    print(f"   Chunk size: {CHUNK_SIZE}, Overlap: {CHUNK_OVERLAP}")
    print()
    
    grand_total = 0
    grand_success = 0
    
    for year in range(START_YEAR, END_YEAR + 1):        
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
        
    print(f"🎉 Ingestion complete!")
    print(f"   Total chunks: {grand_total}")
    print(f"   Successful: {grand_success}")
    print(f"   Failed: {grand_total - grand_success}")


if __name__ == "__main__":
    main()

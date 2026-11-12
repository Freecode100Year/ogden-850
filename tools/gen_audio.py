#!/usr/bin/env python3
"""Pre-record every speakable text of index.html for the offline Android app.

    /opt/ogden-venv/bin/python tools/gen_audio.py OUT_DIR [--limit N] [--jobs 6]

Writes OUT_DIR/uk/<id>.ogg and OUT_DIR/us/<id>.ogg (Opus, mono, 16 kbit/s).
<id> is cyrb53(text) in hex — the same function index.html uses to find the
file, so no index is needed. Existing files are kept, so the script can be
re-run to fill gaps. Needs edge-tts and ffmpeg.
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile

import edge_tts

VOICES = {"uk": "en-GB-SoniaNeural", "us": "en-US-JennyNeural"}
HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "..", "index.html")


def cyrb53(s: str, seed: int = 0) -> int:
    """Same as cyrb53 in index.html (JS strings are UTF-16 code units)."""
    M = 0xFFFFFFFF
    h1 = (0xDEADBEEF ^ seed) & M
    h2 = (0x41C6CE57 ^ seed) & M
    units = s.encode("utf-16-le")
    for i in range(0, len(units), 2):
        ch = units[i] | (units[i + 1] << 8)
        h1 = ((h1 ^ ch) * 2654435761) & M
        h2 = ((h2 ^ ch) * 1597334677) & M
    h1 = (((h1 ^ (h1 >> 16)) * 2246822507) & M) ^ (((h2 ^ (h2 >> 13)) * 3266489909) & M)
    h2 = (((h2 ^ (h2 >> 16)) * 2246822507) & M) ^ (((h1 ^ (h1 >> 13)) * 3266489909) & M)
    return 4294967296 * (2097151 & h2) + (h1 & M)


def audio_id(text: str) -> str:
    return format(cyrb53(text), "x")


def texts() -> list[str]:
    """Every string a speak button can read (see the data-text attributes in index.html)."""
    s = open(INDEX, encoding="utf-8").read()
    data = json.loads(re.search(r'<script[^>]*id="data"[^>]*>(.*?)</script>', s, re.S).group(1))
    sd = json.loads(re.search(r'<script[^>]*id="syns-detail"[^>]*>(.*?)</script>', s, re.S).group(1))
    cjk = re.compile(r"^([^一-鿿぀-ヿ＀-￯]+)")  # extractEnPart()
    out = set()
    for w in data:
        for k in ("w", "en", "ex"):
            if w.get(k):
                out.add(w[k])
        out.update(w.get("s", []))
    for main, d in sd.items():
        out.add(main)
        for syn, info in d.items():
            out.add(syn)
            m = cjk.match(info.get("use", "") or "")
            if m and m.group(1).strip():
                out.add(m.group(1).strip())
    out.update(m for m in re.findall(r'data-text="([^"$]+)"', s))
    return sorted(t for t in out if t.strip())


async def one(text: str, accent: str, path: str, sem: asyncio.Semaphore) -> bool:
    async with sem:
        rate = "+0%" if len(text.split()) <= 1 else "-5%"
        for attempt in range(4):
            try:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    mp3 = tmp.name
                await edge_tts.Communicate(text, VOICES[accent], rate=rate).save(mp3)
                r = subprocess.run(
                    ["ffmpeg", "-loglevel", "error", "-y", "-i", mp3, "-ac", "1", "-c:a", "libopus",
                     "-b:a", "16k", "-application", "voip", path + ".tmp.ogg"],
                    capture_output=True)
                os.unlink(mp3)
                if r.returncode == 0 and os.path.getsize(path + ".tmp.ogg") > 200:
                    os.replace(path + ".tmp.ogg", path)
                    return True
            except Exception as e:  # network hiccup or throttling: wait and retry
                print(f"  retry {accent} {text[:40]!r}: {e}", file=sys.stderr)
            await asyncio.sleep(2 + attempt * 3)
        return False


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    items = texts()
    ids = {}
    for t in items:
        i = audio_id(t)
        if i in ids and ids[i] != t:
            sys.exit(f"hash collision: {t!r} / {ids[i]!r}")
        ids[i] = t
    if a.limit:
        items = items[: a.limit]
    sem = asyncio.Semaphore(a.jobs)
    jobs = []
    for accent in VOICES:
        os.makedirs(os.path.join(a.out, accent), exist_ok=True)
        for t in items:
            p = os.path.join(a.out, accent, audio_id(t) + ".ogg")
            if not os.path.exists(p):
                jobs.append(one(t, accent, p, sem))
    print(f"{len(items)} texts, {len(jobs)} files to record", flush=True)
    done = failed = 0
    for f in asyncio.as_completed(jobs):
        ok = await f
        done += 1
        failed += not ok
        if done % 500 == 0:
            print(f"  {done}/{len(jobs)} ({failed} failed)", flush=True)
    print(f"finished: {done - failed} recorded, {failed} failed", flush=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())

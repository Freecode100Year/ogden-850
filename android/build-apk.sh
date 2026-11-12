#!/usr/bin/env bash
# Build the offline Android app.
#
#   AUDIO_DIR=/path/to/audio android/build-apk.sh        # → android/ogden-850.apk
#
# AUDIO_DIR is the output of tools/gen_audio.py (uk/ and us/ with *.ogg). Signing
# uses android/keystore.properties; without it the APK is unsigned.
# Needs JDK 17+, the Android SDK (ANDROID_HOME) and Gradle 9.
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..
A=app/src/main/assets
AUDIO_DIR=${AUDIO_DIR:-}
[ -n "$AUDIO_DIR" ] && [ -d "$AUDIO_DIR/uk" ] && [ -d "$AUDIO_DIR/us" ] || { echo "set AUDIO_DIR (see tools/gen_audio.py)" >&2; exit 1; }

rm -rf "$A"
mkdir -p "$A/icons" "$A/fonts/files" "$A/audio"
cp "$ROOT/index.html" "$ROOT/manifest.json" "$ROOT/favicon.png" "$A/"
cp "$ROOT"/icons/*.png "$A/icons/"
cp fonts/fonts.css "$A/fonts/"
cp fonts/files/*.woff2 "$A/fonts/files/"
cp -r "$AUDIO_DIR/uk" "$AUDIO_DIR/us" "$A/audio/"
echo "assets: $(find "$A" -type f | wc -l) files, $(du -sh "$A" | cut -f1)"

GRADLE=${GRADLE:-gradle}
"$GRADLE" --no-daemon -q assembleRelease
OUT=app/build/outputs/apk/release
APK=$(ls "$OUT"/*.apk | head -1)
cp "$APK" ogden-850.apk
echo "built android/ogden-850.apk ($(du -h ogden-850.apk | cut -f1))"

#!/usr/bin/env bash
# Runs ON the Runpod GPU machine (started by cloud/render.sh). Sets up Blender, fetches the repo and
# the CC0 Poly Haven assets, renders each job, then hands the results back with `runpodctl send`.
#
# Environment (set by render.sh):
#   WA_BRANCH  git branch of github.com/nicolescheid/whiskedaway to render from
#   WA_BUILD   build script in blender/, e.g. hallway_build.py
#   WA_JOBS    jobs separated by ';', each the arguments after `--`, e.g. "--weather=rain --stop=entrance"
#   WA_CODE    transfer code the local machine is waiting on with `runpodctl receive`
# Progress goes to /srv/status/log.txt, served on port 8000 so render.sh can show it.
set -uo pipefail

BLENDER_VERSION=5.1.0
RUNPODCTL_VERSION=2.14.0
mkdir -p /srv/status
LOG=/srv/status/log.txt
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# Delete this pod however the script ends, so it never sits there billing
cleanup() {
  log "cleaning up: deleting pod ${RUNPOD_POD_ID:-?}"
  runpodctl remove pod "${RUNPOD_POD_ID}" >/dev/null 2>&1 || runpodctl pod delete "${RUNPOD_POD_ID}" >/dev/null 2>&1
}
trap cleanup EXIT

fail() { log "FAILED: $*"; sleep 120; exit 1; }   # the pause lets render.sh read the log first

log "setting up"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq git wget xz-utils python3 ca-certificates \
  libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 >/dev/null || fail "apt-get"
command -v python3 >/dev/null || fail "python3 missing"
(cd /srv/status && python3 -m http.server 8000 >/dev/null 2>&1 &)

if ! command -v runpodctl >/dev/null; then
  wget -q -O /usr/local/bin/runpodctl \
    "https://github.com/runpod/runpodctl/releases/download/v${RUNPODCTL_VERSION}/runpodctl-linux-amd64" || fail "runpodctl download"
  chmod +x /usr/local/bin/runpodctl
fi

log "downloading Blender ${BLENDER_VERSION}"
cd /opt
TARBALL="blender-${BLENDER_VERSION}-linux-x64.tar.xz"
SERIES="Blender${BLENDER_VERSION%.*}"
wget -q "https://download.blender.org/release/${SERIES}/${TARBALL}" || fail "Blender download"
wget -q -O blender.sha256 "https://download.blender.org/release/${SERIES}/blender-${BLENDER_VERSION}.sha256" \
  && { grep "$TARBALL" blender.sha256 | sha256sum -c - >/dev/null || fail "Blender checksum mismatch"; } \
  || log "no checksum file published; skipping the check"
tar -xf "$TARBALL" || fail "Blender unpack"
BLENDER="/opt/blender-${BLENDER_VERSION}-linux-x64/blender"

log "cloning ${WA_BRANCH}"
git clone -q --depth 1 --branch "$WA_BRANCH" https://github.com/nicolescheid/whiskedaway.git /work || fail "git clone"
cd /work
log "fetching Poly Haven assets"
python3 -I blender/fetch_assets.py >>"$LOG" 2>&1 || fail "fetch_assets"
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader >>"$LOG" 2>&1

IFS=';' read -ra JOBS <<<"$WA_JOBS"
for job in "${JOBS[@]}"; do
  log "rendering: ${job}"
  start=$(date +%s)
  # shellcheck disable=SC2086
  "$BLENDER" -b --factory-startup --python "blender/${WA_BUILD}" -- $job >blender.log 2>&1 \
    || { tail -30 blender.log >>"$LOG"; fail "Blender exited with an error on: ${job}"; }
  grep -E "OPTIX|CUDA|\[whisked\]" blender.log | tail -5 >>"$LOG"
  log "finished in $(( ($(date +%s) - start) / 60 )) min: ${job}"
done

log "packing results"
cd blender/out
tar -cf /srv/results.tar --exclude='*.blend*' --exclude='*.png' . || fail "tar"
log "sending results (code ${WA_CODE})"
# send waits until the local machine has received; give up after an hour
timeout 3600 runpodctl send /srv/results.tar --code "$WA_CODE" >>"$LOG" 2>&1 || fail "send"
log "DONE"

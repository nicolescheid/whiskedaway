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
python3 -I blender/fetch_assets.py >assets.log 2>&1 || { tail -20 assets.log >>"$LOG"; fail "fetch_assets"; }
log "assets ready ($(grep -c '^  got' assets.log) files)"
log "GPU: $(nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>&1)"
log "NVIDIA libraries: $(ls /usr/lib/x86_64-linux-gnu/ 2>/dev/null | grep -oE '^lib(cuda|nvoptix|nvidia-rtcore)\.so[.0-9]*' | sort -u | tr '\n' ' ')"
log "driver capabilities: ${NVIDIA_DRIVER_CAPABILITIES:-unset}"
log "device files: $(ls /dev/ | grep -E '^nvidia' | tr '\n' ' ')"
command -v python >/dev/null && log "torch sees CUDA: $(python -c 'import torch; print(torch.cuda.is_available(), torch.version.cuda)' 2>&1 | tail -1)"

# Ask Blender which GPUs it can use before spending time on a build
cat >/tmp/probe.py <<'PY'
import bpy
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
        prefs.get_devices()
        print("[probe]", backend, [d.name for d in prefs.devices if d.type == backend], flush=True)
    except Exception as e:
        print("[probe]", backend, "error:", e, flush=True)
PY
"$BLENDER" -b --factory-startup --python /tmp/probe.py >probe.log 2>&1
grep -E "\[probe\]|cuda|optix|CUDA|OptiX" probe.log | head -12 >>"$LOG"
grep -qE "\[probe\] (OPTIX|CUDA) \['" probe.log || fail "Blender can't see the GPU"
[ "$WA_JOBS" = "probe" ] && { log "probe only: DONE"; exit 0; }

IFS=';' read -ra JOBS <<<"$WA_JOBS"
for job in "${JOBS[@]}"; do
  log "rendering: ${job}"
  start=$(date +%s)
  # shellcheck disable=SC2086
  "$BLENDER" -b --factory-startup --python "blender/${WA_BUILD}" -- $job >blender.log 2>&1 &
  pid=$!
  gpu_checked=0 last=""
  while kill -0 "$pid" 2>/dev/null; do
    sleep 15
    tail -c 6000 blender.log | tr '\r' '\n' | tail -40 >/srv/status/blender_tail.txt   # served beside log.txt
    # Once sampling starts the GPU should be busy; an idle GPU means Cycles fell back to the CPU
    if [ "$gpu_checked" -lt 2 ] && grep -q "Sample [0-9]" blender.log; then
      util=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ')
      if [ "${util:-0}" -ge 30 ]; then
        log "GPU busy (${util}%): rendering on the GPU"; gpu_checked=2
      elif [ "$gpu_checked" = 1 ]; then
        kill "$pid"; grep -iE "optix|cuda|device" blender.log | tail -10 >>"$LOG"; fail "Blender is rendering on the CPU, not the GPU (GPU ${util}%)"
      else
        gpu_checked=1                                    # one more look before giving up
      fi
    fi
    now=$(grep -oE "Sample [0-9]+/[0-9]+" blender.log | tail -1)
    [ -n "$now" ] && [ "$now" != "$last" ] && [ $(( $(date +%s) % 60 )) -lt 15 ] && { log "  $now"; last=$now; }
  done
  wait "$pid" || { tail -30 blender.log >>"$LOG"; fail "Blender exited with an error on: ${job}"; }
  log "finished in $(( ($(date +%s) - start) / 60 )) min: ${job}"
done

log "packing results"
cd blender/out
tar -cf /srv/results.tar --exclude='*.blend*' --exclude='*.png' . || fail "tar"
log "sending results (code ${WA_CODE})"
# send waits until the local machine has received; give up after an hour
timeout 3600 runpodctl send /srv/results.tar --code "$WA_CODE" >>"$LOG" 2>&1 || fail "send"
log "DONE"

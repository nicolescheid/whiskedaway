#!/usr/bin/env bash
# Runs ON the Runpod GPU machine (started by cloud/render.sh), inside the image from cloud/Dockerfile,
# which already holds Blender, the CC0 Poly Haven assets and runpodctl. Checks the GPU, clones the repo,
# renders each job, then hands the results back with `runpodctl send`.
#
# Environment (set by render.sh):
#   WA_BRANCH  git branch of github.com/nicolescheid/whiskedaway to render from
#   WA_BUILD   build script in blender/, e.g. hallway_build.py
#   WA_JOBS    jobs separated by ';', each the arguments after `--`, e.g. "--weather=rain --stop=entrance";
#              "probe" only checks the GPU
#   WA_CODE    transfer code the local machine is waiting on with `runpodctl receive`
# Progress goes to /srv/status/log.txt, served on port 8000 so render.sh can show it.
set -uo pipefail

BLENDER="${BLENDER:-/opt/blender/blender}"
WA_ASSETS="${WA_ASSETS:-/opt/wa-assets}"
mkdir -p /srv/status
LOG=/srv/status/log.txt
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
(cd /srv/status && python3 -m http.server 8000 >/dev/null 2>&1 &)

# Delete this pod however the script ends, so it never sits there billing
cleanup() {
  log "cleaning up: deleting pod ${RUNPOD_POD_ID:-?}"
  runpodctl pod delete "${RUNPOD_POD_ID}" >/dev/null 2>&1 || runpodctl remove pod "${RUNPOD_POD_ID}" >/dev/null 2>&1
}
trap cleanup EXIT

fail() { log "FAILED: $*"; sleep 120; exit 1; }   # the pause lets render.sh read the log first
# NOGPU tells render.sh this machine is the problem, so it can try another one
nogpu() { log "NOGPU: $*"; sleep 60; exit 1; }

[ -x "$BLENDER" ] || fail "no Blender at $BLENDER (is the pod using the whiskedaway-render image?)"
log "GPU: $(nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>&1)"
log "host: ${RUNPOD_DC_ID:-?} $(uname -r)"
log "device files: $(ls /dev/ | grep -E '^nvidia' | tr '\n' ' ')"
log "NVIDIA libraries: $(ldconfig -p | grep -oE 'lib(cuda|nvoptix|nvidia-rtcore)\.so[.0-9]*' | sort -u | tr '\n' ' ')"

# Ask the driver directly first: if cuInit fails here, no setting inside the container will fix it
cuinit=$(python3 - <<'PY' 2>&1
import ctypes
try:
    cu = ctypes.CDLL("libcuda.so.1")
except OSError as e:
    print("no libcuda:", e); raise SystemExit
r = cu.cuInit(0)
n = ctypes.c_int(0)
if r == 0:
    cu.cuDeviceGetCount(ctypes.byref(n))
v = ctypes.c_int(0); cu.cuDriverGetVersion(ctypes.byref(v))
print(f"cuInit={r} devices={n.value} driver_cuda={v.value}")
PY
)
log "CUDA driver check: $cuinit"
case "$cuinit" in cuInit=0\ *) ;; *) nogpu "CUDA won't initialise on this machine ($cuinit)";; esac

# Then ask Blender which GPUs it can use
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
"$BLENDER" -b --factory-startup --python /tmp/probe.py >/tmp/probe.log 2>&1
grep -E "\[probe\]|cuda|optix|CUDA|OptiX" /tmp/probe.log | head -12 >>"$LOG"
grep -qE "\[probe\] OPTIX \['" /tmp/probe.log || log "warning: no OptiX device; Cycles will use CUDA"
grep -qE "\[probe\] (OPTIX|CUDA) \['" /tmp/probe.log || nogpu "Blender can't see the GPU"
[ "$WA_JOBS" = "probe" ] && { log "probe only: DONE"; sleep 45; exit 0; }   # pause so render.sh sees it

log "cloning ${WA_BRANCH}"
# Sparse: the committed renders (blender/out/*.jpg) and the concept art of rooms not yet in Blender are
# most of the repo, and no build reads them. A full clone had grown to about 6 minutes.
for i in 1 2 3; do
  rm -rf /work
  timeout 300 git clone -q --depth 1 --filter=blob:none --no-checkout --branch "$WA_BRANCH" https://github.com/nicolescheid/whiskedaway.git /work     && git -C /work sparse-checkout set --no-cone '/*' '!/blender/out/*.jpg' '!/art-inbox/'          '/art-inbox/cuddlecore/' '/art-inbox/inn-hallway/' '/art-inbox/glasshouse/'     && timeout 300 git -C /work checkout -q "$WA_BRANCH" && break
  [ "$i" = 3 ] && fail "git clone"; sleep 10
done
cd /work
log "cloned ($(du -sh . | cut -f1))"
rm -rf blender/assets && ln -s "$WA_ASSETS" blender/assets
if [ "$(sha256sum blender/fetch_assets.py | cut -d' ' -f1)" = "$(cat "$WA_ASSETS/.fetch_assets.sha256" 2>/dev/null)" ]; then
  log "assets: using the $(du -sh "$WA_ASSETS" | cut -f1) baked into the image"
else
  log "the asset list changed since the image was built; fetching what's missing"
  for i in 1 2 3; do
    timeout 900 python3 -I -c "import socket, runpy; socket.setdefaulttimeout(60); \
runpy.run_path('blender/fetch_assets.py', run_name='__main__')" >assets.log 2>&1 && break
    [ "$i" = 3 ] && { tail -20 assets.log >>"$LOG"; fail "fetch_assets"; }
    sleep 10
  done
  log "assets ready ($(grep -c '^  got' assets.log) new files)"
fi

touch /srv/render_start   # only files written after this go back (blender/out also holds committed renders)
IFS=';' read -ra JOBS <<<"$WA_JOBS"
for job in "${JOBS[@]}"; do
  log "rendering: ${job}"
  start=$(date +%s)
  # shellcheck disable=SC2086
  PYTHONUNBUFFERED=1 stdbuf -oL -eL "$BLENDER" -b --factory-startup --python "blender/${WA_BUILD}" -- $job >blender.log 2>&1 &
  pid=$!
  gpu_checked=0 last="" peak=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 15
    util=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ')
    [ "${util:-0}" -gt "$peak" ] && peak=$util
    tail -c 6000 blender.log | tr '\r' '\n' | tail -40 >/srv/status/blender_tail.txt   # served beside log.txt
    # Once sampling starts the GPU should be busy; an idle GPU means Cycles fell back to the CPU
    if [ "$gpu_checked" -lt 2 ] && grep -q "Sample [0-9]" blender.log; then
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
  grep -m1 "\[whisked\] rendering on" blender.log >>"$LOG" || log "warning: the build never said it was using the GPU"
  log "peak GPU use: ${peak}%"
  # A quick preview can finish between two looks at the GPU; only fail when sampling was seen with the GPU idle
  if [ "$peak" -lt 30 ]; then
    [ "$gpu_checked" = 0 ] && log "warning: too quick to catch the GPU at work (peak ${peak}%)"       || fail "the GPU stayed idle, so this rendered on the CPU: ${job}"
  fi
  log "finished in $(( ($(date +%s) - start) / 60 )) min: ${job}"
done

log "packing results"
cd blender/out
find . -type f -newer /srv/render_start ! -name '*.blend*' ! -name '*.png' -printf '%P\n' >/srv/results.list
[ -s /srv/results.list ] || fail "the render wrote nothing to blender/out"
log "results: $(tr '\n' ' ' </srv/results.list)"
tar -cf /srv/results.tar -T /srv/results.list || fail "tar"
# runpodctl 2.x adds a relay number to the code (wa-…-3), so pass on the code it actually prints
timeout 3600 runpodctl send /srv/results.tar --code "$WA_CODE" >/srv/send.log 2>&1 &
send_pid=$!
for _ in $(seq 60); do grep -q "code is:" /srv/send.log && break; kill -0 "$send_pid" 2>/dev/null || break; sleep 2; done
code=$(grep -oE "code is: \S+" /srv/send.log | head -1 | cut -d' ' -f3)
[ -n "$code" ] || { tail -5 /srv/send.log >>"$LOG"; fail "send didn't give a code"; }
log "sending results, receive code: $code"
# send waits until the local machine has received; give up after an hour
wait "$send_pid" || { tail -5 /srv/send.log >>"$LOG"; fail "send"; }
log "DONE"

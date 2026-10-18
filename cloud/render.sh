#!/usr/bin/env bash
# Render WhiskedAway panoramas on a rented Runpod GPU, from Git Bash on this laptop.
#
#   cloud/render.sh --build hallway_build.py --jobs "--weather=rain --stop=entrance" [options]
#
# Starts a pod, which runs cloud/pod_render.sh from GitHub (so commit and push first), shows its
# progress, receives the renders into --out, and deletes the pod however this script ends.
# (A hard kill skips that clean-up: then check `runpodctl pod list` and delete any whiskedaway-render pod.)
#
# Options:
#   --branch B     branch to render from (default: the current branch; it must be pushed)
#   --build F      build script in blender/ (required)
#   --jobs J       jobs separated by ';', each the arguments after `--` for the build (required)
#   --out D        where the renders go (default: blender/out)
#   --gpu G        GPU type from `runpodctl gpu list` (default: NVIDIA GeForce RTX 4090)
#   --cloud C      COMMUNITY or SECURE (default: COMMUNITY)
#   --max-min N    give up and delete the pod after N minutes (default: 120)
#   --image I      container image (default: the whiskedaway-render image built from cloud/Dockerfile)
#   --caps C       NVIDIA_DRIVER_CAPABILITIES for the pod (default: compute,utility,graphics)
#
# If a machine's GPU won't initialise (some Community hosts), its pod is deleted and another one is tried.
#
# Needs runpodctl, set up with the API key (see docs or ~/.runpod/config.toml); never pass the key here.
set -euo pipefail

RPC="${RUNPODCTL:-$HOME/tools/runpodctl/runpodctl.exe}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
IMAGE="ghcr.io/nicolescheid/whiskedaway-render:5.1.0"   # Blender + assets baked in (cloud/Dockerfile)
CAPS="compute,utility,graphics" BUILD="" JOBS="" OUT="$ROOT/blender/out" GPU="NVIDIA GeForce RTX 4090" CLOUD="COMMUNITY" MAX_MIN=120
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --build) BUILD="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --gpu) GPU="$2"; shift 2 ;;
    --cloud) CLOUD="$2"; shift 2 ;;
    --max-min) MAX_MIN="$2"; shift 2 ;;
    --image) IMAGE="$2"; shift 2 ;;
    --caps) CAPS="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
[ -n "$BUILD" ] && [ -n "$JOBS" ] || { sed -n '2,22p' "$0"; exit 2; }
[ -f "$ROOT/blender/$BUILD" ] || { echo "no such build script: blender/$BUILD" >&2; exit 2; }

# The pod renders what's on GitHub, so refuse if this branch has unpushed commits
git -C "$ROOT" fetch -q origin "$BRANCH" || { echo "branch $BRANCH isn't on GitHub; push it first" >&2; exit 1; }
if [ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]; then
  echo "branch $BRANCH differs from GitHub; push it first (the pod renders what's on GitHub)" >&2; exit 1
fi

CODE="wa-$(date +%s)-$RANDOM-$RANDOM"
# by commit, not branch name: raw.githubusercontent.com caches branch URLs for about 5 minutes
RAW="https://raw.githubusercontent.com/nicolescheid/whiskedaway/$(git -C "$ROOT" rev-parse HEAD)/cloud/pod_render.sh"
# The newest pod_render.sh from the branch, or the copy baked into the image if GitHub doesn't answer
START="bash -c 'curl -fsSL --connect-timeout 10 --max-time 60 --retry 3 -o /pod_render.sh ${RAW} || cp /opt/pod_render.sh /pod_render.sh; bash /pod_render.sh'"
ENV=$(python -c 'import json,sys; print(json.dumps(dict(WA_BRANCH=sys.argv[1], WA_BUILD=sys.argv[2], WA_JOBS=sys.argv[3], WA_CODE=sys.argv[4],
  NVIDIA_DRIVER_CAPABILITIES=sys.argv[5])))' \
  "$BRANCH" "$BUILD" "$JOBS" "$CODE" "$CAPS")
json() { python -c "
import json,sys
try: d=json.load(sys.stdin)
except ValueError: d={}
print(d.get('$1', '') if isinstance(d, dict) else '')"; }

POD="" COST="" T0=$(date +%s) RESULT="" RECV_CODE=""
cleanup() {
  [ -n "$POD" ] || return 0
  echo "deleting pod $POD"
  if ! "$RPC" pod delete "$POD" >/dev/null 2>&1 && "$RPC" pod get "$POD" >/dev/null 2>&1; then
    echo "!! couldn't delete pod $POD; delete it at console.runpod.io/pods"
  fi
  mins=$(( ($(date +%s) - T0 + 59) / 60 ))
  [ -n "$COST" ] && python -c "print(f'pod {\"$POD\"}: about {$mins} min at \${float($COST):.2f}/hr = \${$mins/60*float($COST):.2f}')"
  POD=""
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP   # so Ctrl-C and kill still delete the pod

# Starts a pod; Community machines come and go, so "no resources" is worth a few more tries
create_pod() {
  for attempt in 1 2 3 4 5 6 7 8; do
    POD_JSON=$("$RPC" pod create --name "whiskedaway-render" --image "$IMAGE" --gpu-id "$GPU" --cloud-type "$CLOUD"       --container-disk-in-gb 20 --ports "8000/http" --env "$ENV" --docker-args "$START" 2>&1 || true)
    POD=$(echo "$POD_JSON" | json id 2>/dev/null || true)
    [ -n "$POD" ] && break
    echo "no $GPU free yet (try $attempt): $(echo "$POD_JSON" | head -c 160)"
    sleep 30
  done
  [ -n "$POD" ] || { echo "couldn't create the pod: $POD_JSON" >&2; exit 1; }
  COST=$(echo "$POD_JSON" | json costPerHr)
  T0=$(date +%s)
  echo "pod $POD (\$${COST:-?}/hr)"
}

# Shows the pod's log until it says what happened: sets RESULT to send, probe, nogpu or fails
watch_pod() {
  local log_url="https://${POD}-8000.proxy.runpod.net/log.txt" shown=0 log total status
  while :; do
    sleep 20
    if [ $(( $(date +%s) - T0 )) -gt $(( MAX_MIN * 60 )) ]; then echo "gave up after $MAX_MIN min" >&2; exit 1; fi
    log=$(curl -fsS --max-time 15 "$log_url" 2>/dev/null || true)
    if [ -z "$log" ]; then
      if "$RPC" pod get "$POD" 2>&1 | grep -q '"not_found"'; then echo "pod $POD has gone (it deletes itself when it stops)" >&2; exit 1; fi
      status=$("$RPC" pod get "$POD" 2>/dev/null | json desiredStatus || true)
      if [ "$status" = "EXITED" ] || [ "$status" = "TERMINATED" ]; then echo "pod stopped before it reported anything" >&2; exit 1; fi
      continue
    fi
    total=$(printf '%s
' "$log" | wc -l)
    [ "$total" -gt "$shown" ] && printf '%s
' "$log" | tail -n +$((shown + 1)) && shown=$total
    if printf '%s' "$log" | grep -q "NOGPU"; then RESULT=nogpu; return; fi
    if printf '%s' "$log" | grep -q "FAILED"; then echo "the render failed (see above)" >&2; exit 1; fi
    if printf '%s' "$log" | grep -q "receive code:"; then RESULT=send; RECV_CODE=$(printf '%s' "$log" | grep -oE "receive code: \S+" | tail -1 | cut -d' ' -f3); return; fi
    if printf '%s' "$log" | grep -q "probe only: DONE"; then RESULT=probe; return; fi
  done
}

echo "starting a $CLOUD $GPU pod to render $BUILD from $BRANCH ($IMAGE)"
for machine in 1 2 3 4; do
  create_pod
  watch_pod
  [ "$RESULT" = nogpu ] || break
  echo "this machine's GPU won't work; trying another (machine $machine)"
  cleanup
done
[ "$RESULT" = nogpu ] && { echo "no machine with a working GPU after 4 tries" >&2; exit 1; }
[ "$RESULT" = probe ] && { echo "probe passed in $(( ($(date +%s) - T0) / 60 )) min"; exit 0; }

TMP=$(mktemp -d)
echo "receiving results"
for _ in 1 2 3 4 5 6; do
  (cd "$TMP" && "$RPC" receive "$RECV_CODE") && break
  sleep 10
done
[ -f "$TMP/results.tar" ] || { echo "didn't receive the results" >&2; exit 1; }
mkdir -p "$OUT"
tar -xf "$TMP/results.tar" -C "$OUT"
rm -rf "$TMP"
echo "renders are in $OUT:"
ls -l "$OUT" | grep -v '^total'

#!/usr/bin/env bash
# Render WhiskedAway panoramas on a rented Runpod GPU, from Git Bash on this laptop.
#
#   cloud/render.sh --build hallway_build.py --jobs "--weather=rain --stop=entrance" [options]
#
# Starts a pod, which runs cloud/pod_render.sh from GitHub (so commit and push first), shows its
# progress, receives the renders into --out, and deletes the pod however this script ends.
#
# Options:
#   --branch B     branch to render from (default: the current branch; it must be pushed)
#   --build F      build script in blender/ (required)
#   --jobs J       jobs separated by ';', each the arguments after `--` for the build (required)
#   --out D        where the renders go (default: blender/out)
#   --gpu G        GPU type from `runpodctl gpu list` (default: NVIDIA GeForce RTX 4090)
#   --cloud C      COMMUNITY or SECURE (default: COMMUNITY)
#   --max-min N    give up and delete the pod after N minutes (default: 120)
#
# Needs runpodctl, set up with the API key (see docs or ~/.runpod/config.toml); never pass the key here.
set -euo pipefail

RPC="${RUNPODCTL:-$HOME/tools/runpodctl/runpodctl.exe}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
BUILD="" JOBS="" OUT="$ROOT/blender/out" GPU="NVIDIA GeForce RTX 4090" CLOUD="COMMUNITY" MAX_MIN=120
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --build) BUILD="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --gpu) GPU="$2"; shift 2 ;;
    --cloud) CLOUD="$2"; shift 2 ;;
    --max-min) MAX_MIN="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
[ -n "$BUILD" ] && [ -n "$JOBS" ] || { sed -n '2,18p' "$0"; exit 2; }
[ -f "$ROOT/blender/$BUILD" ] || { echo "no such build script: blender/$BUILD" >&2; exit 2; }

# The pod renders what's on GitHub, so refuse if this branch has unpushed commits
git -C "$ROOT" fetch -q origin "$BRANCH" || { echo "branch $BRANCH isn't on GitHub; push it first" >&2; exit 1; }
if [ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]; then
  echo "branch $BRANCH differs from GitHub; push it first (the pod renders what's on GitHub)" >&2; exit 1
fi

CODE="wa-$(date +%s)-$RANDOM-$RANDOM"
RAW="https://raw.githubusercontent.com/nicolescheid/whiskedaway/${BRANCH}/cloud/pod_render.sh"
START="bash -c 'apt-get update -qq && apt-get install -y -qq wget ca-certificates >/dev/null && wget -qO /pod_render.sh ${RAW} && bash /pod_render.sh'"
ENV=$(python -c 'import json,sys; print(json.dumps(dict(WA_BRANCH=sys.argv[1], WA_BUILD=sys.argv[2], WA_JOBS=sys.argv[3], WA_CODE=sys.argv[4])))' \
  "$BRANCH" "$BUILD" "$JOBS" "$CODE")
json() { python -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1', '') if isinstance(d, dict) else '')"; }

echo "starting a $CLOUD $GPU pod to render $BUILD from $BRANCH"
POD_JSON=$("$RPC" pod create --name "whiskedaway-render" --image ubuntu:22.04 --gpu-id "$GPU" --cloud-type "$CLOUD" \
  --container-disk-in-gb 40 --ports "8000/http" --env "$ENV" --docker-args "$START")
POD=$(echo "$POD_JSON" | json id)
[ -n "$POD" ] || { echo "couldn't create the pod: $POD_JSON" >&2; exit 1; }
COST=$(echo "$POD_JSON" | json costPerHr)
T0=$(date +%s)
cleanup() {
  echo "deleting pod $POD"
  if ! "$RPC" pod delete "$POD" >/dev/null 2>&1 && "$RPC" pod get "$POD" >/dev/null 2>&1; then
    echo "!! couldn't delete pod $POD; delete it at console.runpod.io/pods"
  fi
  mins=$(( ($(date +%s) - T0 + 59) / 60 ))
  [ -n "$COST" ] && python -c "print(f'about {$mins} min at \${float($COST):.2f}/hr = \${$mins/60*float($COST):.2f}')"
}
trap cleanup EXIT
echo "pod $POD (\$${COST:-?}/hr)"

LOG_URL="https://${POD}-8000.proxy.runpod.net/log.txt"
shown=0
while :; do
  sleep 20
  if [ $(( $(date +%s) - T0 )) -gt $(( MAX_MIN * 60 )) ]; then echo "gave up after $MAX_MIN min" >&2; exit 1; fi
  log=$(curl -fsS --max-time 15 "$LOG_URL" 2>/dev/null || true)
  if [ -z "$log" ]; then
    status=$("$RPC" pod get "$POD" 2>/dev/null | json desiredStatus || true)
    [ "$status" = "EXITED" ] || [ "$status" = "TERMINATED" ] && { echo "pod stopped before it reported anything" >&2; exit 1; }
    continue
  fi
  total=$(printf '%s\n' "$log" | wc -l)
  [ "$total" -gt "$shown" ] && printf '%s\n' "$log" | tail -n +$((shown + 1)) && shown=$total
  if printf '%s' "$log" | grep -q "FAILED"; then echo "the render failed (see above)" >&2; exit 1; fi
  if printf '%s' "$log" | grep -q "sending results"; then break; fi
done

TMP=$(mktemp -d)
echo "receiving results"
for _ in 1 2 3 4 5 6; do
  (cd "$TMP" && "$RPC" receive "$CODE") && break
  sleep 10
done
[ -f "$TMP/results.tar" ] || { echo "didn't receive the results" >&2; exit 1; }
mkdir -p "$OUT"
tar -xf "$TMP/results.tar" -C "$OUT"
rm -rf "$TMP"
echo "renders are in $OUT:"
ls -l "$OUT" | grep -v '^total'

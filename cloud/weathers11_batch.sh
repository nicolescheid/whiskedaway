#!/usr/bin/env bash
# Full renders for the 11 Nov weathers: one pod per build script and one or two weathers (cloud/render.sh is the
# collector for its pod; keep each one running until it prints its results).
#
#   bash cloud/weathers11_batch.sh <build> <weather> [<weather>]
#
# builds: cuddlecore hallway sweet_spells chiapothecary glasshouse, and the garden build in three parts so no pod runs
# near render.sh's time limit (a pod that times out loses every frame): garden-stops (both garden stops),
# garden-flourish and garden-glasshouse (those rooms with the real garden outside). Garden: one weather per pod.
set -euo pipefail
cd "$(dirname "$0")/.."
B=$1; shift
jobs=()
for w in "$@"; do
  case "$B" in
    cuddlecore|hallway|sweet_spells|chiapothecary)
      jobs+=("--weather=$w" "--weather=$w --night" "--weather=$w --dawn" "--weather=$w --dusk") ;;
    glasshouse)        # spring is the garden build's --room=glasshouse; the other seasons have day and night only
      for s in summer autumn winter; do jobs+=("--weather=$w --season=$s" "--weather=$w --season=$s --night"); done ;;
    garden-stops)      for t in "" " --night" " --dawn" " --dusk"; do jobs+=("--weather=$w --stop=all$t"); done ;;
    garden-flourish)   for t in "" " --night" " --dawn" " --dusk"; do jobs+=("--weather=$w --room=flourish$t"); done ;;
    garden-glasshouse) for t in "" " --night" " --dawn" " --dusk"; do jobs+=("--weather=$w --room=glasshouse$t"); done ;;
    *) echo "unknown build $B" >&2; exit 2 ;;
  esac
done
J=$(IFS=';'; echo "${jobs[*]}")
echo "[batch] $B $* : ${#jobs[@]} jobs"
exec bash cloud/render.sh --build "${B%%-*}_build.py" --jobs "$J" --max-min 180 ${GPU:+--gpu "$GPU"}   # GPU="NVIDIA RTX A5000": cheapest per frame

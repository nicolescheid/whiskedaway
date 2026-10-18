# Rendering on Runpod

Full-quality renders (8K panoramas, 384 samples) can run on a rented GPU instead of the laptop.
Quick previews stay local. On a Secure Cloud RTX 4090 a hallway panorama takes about 4 minutes to
render and 6–7 minutes of pod time in all, which is roughly US$0.10 per view.

## How to run it

From Git Bash, in a checkout whose branch is pushed to GitHub (the pod renders what's on GitHub, and
render.sh refuses if your branch differs from it):

    bash cloud/render.sh --build hallway_build.py --jobs "--weather=rain --stop=entrance"

- `--jobs` takes jobs separated by `;`, each the arguments you'd put after `--` for the build script.
  Several jobs in one run share the ~1.5 minute start-up:
  `--jobs "--weather=fair;--weather=fair --night"`.
- `--jobs probe` only checks that Blender can see the GPU. It costs about US$0.02.
- Renders land in `blender/out` (change it with `--out DIR`). Only files the render wrote come back.
- `--gpu "NVIDIA A40"` picks another GPU type (names from `runpodctl gpu list`). `--cloud COMMUNITY`
  uses Community Cloud, which is cheaper but see below.
- For a batch, run several render.sh at once in separate shells, one view or a few per pod.

render.sh deletes its pod however it ends, including Ctrl-C. A hard kill (closing the window, SIGKILL)
skips that, so after every run check:

    ~/tools/runpodctl/runpodctl.exe pod list

and expect `[]`. A stopped or errored pod can still bill. Spend shows in
`runpodctl billing pods --grouping podId --bucket-size hour`, about an hour behind.

## What's where

- `cloud/render.sh` runs on the laptop. It starts the pod, shows its log (served by the pod on port 8000),
  retries when no GPU is free or the machine's GPU is broken, receives the results and deletes the pod.
- `cloud/pod_render.sh` runs in the pod. It checks the GPU, clones the branch, renders each job, checks
  the GPU really did the work (peak use must reach 30%), and sends the results back with `runpodctl send`.
  render.sh fetches it from GitHub by commit SHA, so a pod always runs the version you pushed.
- `cloud/Dockerfile` builds the image `ghcr.io/nicolescheid/whiskedaway-render:5.1.0` (public): Ubuntu 24.04,
  Blender 5.1.0, runpodctl 2.14.0 and the 229 MB of Poly Haven assets. `.github/workflows/render-image.yml`
  rebuilds it when cloud/Dockerfile or blender/fetch_assets.py change. If fetch_assets.py has changed since
  the image was built, the pod fetches the missing assets itself, with timeouts.
- runpodctl and its API key live on the laptop (`~/tools/runpodctl`, `~/.runpod/config.toml`). The key is a
  Restricted key with Pods read/write only. Never pass it on the command line or paste it anywhere.

## Two things to know when building a new room

**Branches share one image.** `.github/workflows/render-image.yml` runs on a push to any branch that
changes cloud/Dockerfile or blender/fetch_assets.py (or the workflow itself). Every run pushes the same
tag, `whiskedaway-render:5.1.0`, so the last branch to push wins and branches overwrite each other's
image. Renders still work: a pod whose image has a different fetch_assets.py fetches what's missing
before it renders. That start is slower, by however long the missing assets take to download.
A fix would be to run the workflow only on pushes to main (`branches: [main]` under `push:`), and to use
the `sha-` tag or `workflow_dispatch` when a branch needs its own image. The workflow hasn't been changed.

**Each room's art-inbox folder goes in the sparse checkout.** The pod clones the repo without the
art-inbox, apart from the folders listed in the `git sparse-checkout set` line in cloud/pod_render.sh
(today `cuddlecore/`, `inn-hallway/` and `glasshouse/`). A new room whose build reads from its own
art-inbox folder needs that folder added to the list, or the pod won't have it.

## Why it didn't work at first, and what fixed it

**1. CUDA wouldn't start on Community Cloud 4090s.** Every Community 4090 we were given was on the same
provider's machine (kernel 6.8.0-90-lowlatency, driver 580.126.09). There Blender said `CUDA cuInit:
Unknown error` and PyTorch couldn't use CUDA either. Calling the driver directly (`cuInit` through ctypes,
before Blender is involved) returns 999, so the fault is on the host, below anything a container controls.
The device list on those machines was odd too: `/dev/nvidia1` with no `/dev/nvidia0`, and no OptiX library.

We tested the theory that `NVIDIA_DRIVER_CAPABILITIES=all` caused it: `all` and `compute,utility` fail the
same way, so it wasn't that. A plain Ubuntu image and Runpod's own CUDA image also fail on that host.

Secure Cloud 4090s worked first time in two data centres (EUR-IS-2 on driver 595.91.07, US-IL-1 on driver
570), with OptiX. Runpod's docs say nothing about this. The nearest outside report is a Runpod user whose
pods sometimes came up with a broken GPU, where the only fix was to delete the pod and start a new one.

Fix: render.sh uses Secure Cloud by default (US$0.89/hr for a 4090 instead of about US$0.34). pod_render.sh
calls `cuInit` itself first and, if it fails, logs `NOGPU`. render.sh then deletes that pod and tries
another machine, up to 4 times.

**2. Pods stalled at "downloading Blender".** Each pod downloaded Blender and the assets with no timeouts,
and one sat for 12 minutes. Blender and the assets are now baked into the image, so a pod starts rendering
about 1.5 minutes after it's created. (A network volume would also work, but it bills every month and ties
pods to one data centre.)

**3. The results never came back.** runpodctl 2.14's `send --code X` actually uses the code `X-<number>`,
so `receive X` on the laptop always failed. The pod now logs the code send prints, and render.sh uses that.

**4. Smaller bugs.**
- A probe that passed deleted its pod before render.sh had read the result.
- raw.githubusercontent.com caches branch URLs for about 5 minutes, so pods could run an old pod_render.sh.
  It's now fetched by commit SHA.
- The check for Blender quietly falling back to the CPU never fired, because Blender's output was buffered.
  There's now a peak-GPU-use check after each job.
- Pods sent back every image in blender/out, including the committed ones, not just the new render.

**5. "No instances available".** This happens when a GPU type is sold out. render.sh retries 8 times,
30 seconds apart. If 4090s stay sold out, use another type with `--gpu`.

## Other GPU types

Secure Cloud prices on 2026-10-18 (`runpodctl gpu list` shows current ones and stock):

| GPU | US$/hr | Notes |
|---|---|---|
| RTX 4090 | 0.89 | the default; tested, ~4 min per 8K hallway pano |
| A40 | 0.59 | 48 GB, Ampere with RT cores (OptiX); usually well stocked; probe result below |
| RTX A5000 | 0.27 | 24 GB, Ampere; cheap but slower, often low stock |
| RTX 5090 | 1.19 | faster than a 4090; Blackwell, untested |
| L40S | 1.09 | 48 GB, Ada; untested |

A40 probe (2026-10-18, `--gpu "NVIDIA A40" --jobs probe`): EU-SE-1, driver 580.159.04, `cuInit=0`, Blender
lists the A40 under both OptiX and CUDA. About 1 minute of pod time, US$0.01. That host runs the same 580
driver series as the broken Community 4090s, which is more evidence that the 4090 problem was that one host
and not the driver version. A full A40 render hasn't been timed yet; expect it to be slower than a 4090.

The test renders from 2026-10-18 are in blender/out/cloud-test and cloud-test2 (not committed). Both match
the laptop's blender/out/hallway_pano_entrance_rain.jpg to within sampling noise (mean pixel difference
about 0.4 out of 255).

# The image Runpod pods render in: Blender, the CC0 Poly Haven assets and runpodctl are already inside,
# so a pod starts rendering a couple of minutes after it boots instead of downloading ~600 MB first.
# Built and pushed to ghcr.io/nicolescheid/whiskedaway-render by .github/workflows/render-image.yml.
# Build context is the repo root:  docker build -f cloud/Dockerfile .
FROM ubuntu:24.04

ARG BLENDER_VERSION=5.1.0
ARG RUNPODCTL_VERSION=2.14.0
ENV DEBIAN_FRONTEND=noninteractive \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=all \
    BLENDER=/opt/blender/blender \
    WA_ASSETS=/opt/wa-assets

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git xz-utils python3 \
      libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 libglib2.0-0t64 \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; cd /opt; \
    tarball="blender-${BLENDER_VERSION}-linux-x64.tar.xz"; series="Blender${BLENDER_VERSION%.*}"; \
    curl -fsSL --retry 5 --connect-timeout 20 -o "$tarball" "https://download.blender.org/release/${series}/${tarball}"; \
    curl -fsSL --retry 5 --connect-timeout 20 -o blender.sha256 "https://download.blender.org/release/${series}/blender-${BLENDER_VERSION}.sha256"; \
    grep "$tarball" blender.sha256 | sha256sum -c -; \
    tar -xf "$tarball"; mv "blender-${BLENDER_VERSION}-linux-x64" blender; rm "$tarball" blender.sha256; \
    /opt/blender/blender -b --factory-startup --version | head -1

RUN curl -fsSL --retry 5 --connect-timeout 20 -o /usr/local/bin/runpodctl \
      "https://github.com/runpod/runpodctl/releases/download/v${RUNPODCTL_VERSION}/runpodctl-linux-amd64" \
    && chmod +x /usr/local/bin/runpodctl

# The assets go in /opt/wa-assets; pod_render.sh links them into the clone. fetch_assets.py's hash is kept
# so the pod only re-fetches (and only what's missing) when the asset list has changed since this build.
COPY blender/fetch_assets.py /opt/wa-fetch/blender/fetch_assets.py
RUN set -eux; mkdir -p "$WA_ASSETS"; ln -s "$WA_ASSETS" /opt/wa-fetch/blender/assets; \
    for i in 1 2 3; do python3 -I -c "import socket, runpy; socket.setdefaulttimeout(60); \
runpy.run_path('/opt/wa-fetch/blender/fetch_assets.py', run_name='__main__')" && break; sleep 10; done; \
    sha256sum /opt/wa-fetch/blender/fetch_assets.py | cut -d' ' -f1 > "$WA_ASSETS/.fetch_assets.sha256"; \
    du -sh "$WA_ASSETS"

COPY cloud/pod_render.sh /opt/pod_render.sh
CMD ["bash", "/opt/pod_render.sh"]

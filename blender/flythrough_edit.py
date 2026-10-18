"""
Assembles the Inn fly-through (docs/flythrough-plan.md) from the rendered frames with ffmpeg:
the storybook push-in, the hallway shots, a dissolve into the kitchen, and back out to the whisk.
Silent, ready for a voice-over and music in the final edit.

Run with plain Python after the Blender renders:
  python -I blender/flythrough_edit.py [--rough]
Frames come from blender/out/flythrough/<rough|final>/hall_*.{jpg,png} and kitchen_*.
Writes blender/out/flythrough/inn-flythrough[-rough].mp4.
"""
import os
import subprocess
import sys
import tempfile

ROUGH = "--rough" in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
FLY = os.path.join(HERE, "out", "flythrough")
FRAMES = os.path.join(FLY, "rough" if ROUGH else "final")
WHISK = os.path.join(os.path.dirname(HERE), "art-inbox", "inn-exterior", "whisk-inn-master.png")
OUTFILE = os.path.join(FLY, "inn-flythrough-rough.mp4" if ROUGH else "inn-flythrough.mp4")
W, H = (640, 360) if ROUGH else (1920, 1080)
FPS = 24
STEP = 2 if ROUGH else 1          # the rough render keeps every other frame
FADE = 0.75                       # seconds for each dissolve
INTRO, OUTRO = 5.0, 3.0
DOOR = (0.622, 0.50)              # the front door's place in the storybook picture, as a fraction of its size


def frame_list(prefix):
    """A concat list that plays the rendered frames at 24 fps, whatever the step between them."""
    files = sorted(f for f in os.listdir(FRAMES) if f.startswith(prefix))
    if not files:
        sys.exit(f"no {prefix} frames in {FRAMES}")
    fd, path = tempfile.mkstemp(suffix=".txt", text=True)
    with os.fdopen(fd, "w") as fh:
        for f in files:
            fh.write(f"file '{os.path.join(FRAMES, f)}'\nduration {STEP / FPS:.6f}\n")
        fh.write(f"file '{os.path.join(FRAMES, files[-1])}'\n")   # concat needs the last one twice
    return path, len(files) * STEP / FPS


def main():
    hall_list, hall_len = frame_list("hall_")
    kitchen_list, kitchen_len = frame_list("kitchen_")
    # Storybook push: start on the whole whisk, end close on the front door (and the reverse for the outro)
    big = f"scale={W * 4}:-2"
    push_in = (f"{big},zoompan=z='1+1.4*on/{int(INTRO * FPS)}':x='iw*{DOOR[0]}-iw/zoom/2':y='ih*{DOOR[1]}-ih/zoom/2'"
               f":d=1:s={W}x{H}:fps={FPS}")
    pull_out = (f"{big},zoompan=z='1.5-0.5*on/{int(OUTRO * FPS)}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2'"
                f":d=1:s={W}x{H}:fps={FPS}")
    fit = f"scale={W}:{H},fps={FPS},format=yuv420p,setsar=1"
    t1 = INTRO - FADE                       # intro -> hallway
    t2 = t1 + hall_len - FADE               # hallway -> kitchen
    t3 = t2 + kitchen_len - FADE            # kitchen -> whisk
    graph = ";".join([
        f"[0:v]{push_in},trim=duration={INTRO},format=yuv420p,setsar=1[intro]",
        f"[1:v]{fit}[hall]",
        f"[2:v]{fit}[kitchen]",
        f"[3:v]{pull_out},trim=duration={OUTRO},format=yuv420p,setsar=1[outro]",
        f"[intro][hall]xfade=transition=fade:duration={FADE}:offset={t1:.3f}[a]",
        f"[a][kitchen]xfade=transition=fade:duration={FADE}:offset={t2:.3f}[b]",
        f"[b][outro]xfade=transition=fade:duration={FADE}:offset={t3:.3f}[v]",
    ])
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-loop", "1", "-framerate", str(FPS), "-t", str(INTRO + 1), "-i", WHISK,
           "-f", "concat", "-safe", "0", "-i", hall_list,
           "-f", "concat", "-safe", "0", "-i", kitchen_list,
           "-loop", "1", "-framerate", str(FPS), "-t", str(OUTRO + 1), "-i", WHISK,
           "-filter_complex", graph, "-map", "[v]", "-r", str(FPS),
           "-c:v", "libx264", "-crf", "23" if ROUGH else "16", "-preset", "medium", "-pix_fmt", "yuv420p", OUTFILE]
    subprocess.run(cmd, check=True)
    for p in (hall_list, kitchen_list):
        os.remove(p)
    print(f"wrote {OUTFILE} ({t3 + OUTRO:.1f} s)")


if __name__ == "__main__":
    main()

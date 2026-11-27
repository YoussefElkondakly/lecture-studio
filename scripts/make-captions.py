"""Write WebVTT captions for public/samples/final-video-sample.mp4 from the narration clip durations."""
import subprocess

TEXTS = [
    "Synthetic narration sample one. This placeholder clip stands in for a generated voice chunk in the Lecture Studio prototype.",
    "Synthetic narration sample two. In the real product, each chunk would be sixty to ninety seconds of approved transcript.",
    "Synthetic narration sample three. The measured duration shown on screen is simulated, not the length of this clip.",
]


def fmt(t):
    m, s = divmod(t, 60)
    return f"00:{int(m):02d}:{s:06.3f}"


t = 0.0
out = ["WEBVTT", "", "NOTE Synthetic sample captions for final-video-sample.mp4 (Lecture Studio prototype)", ""]
for i, text in enumerate(TEXTS, 1):
    d = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"public/samples/voice-en-0{i}.m4a",
    ]).decode().strip())
    out += [str(i), f"{fmt(t)} --> {fmt(t + d)}", text, ""]
    t += d
with open("public/samples/final-video-sample.vtt", "w") as f:
    f.write("\n".join(out))

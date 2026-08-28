from pathlib import Path
import struct
import zlib

OUT = Path(__file__).resolve().parent

C0 = (27, 42, 107)
C1 = (91, 45, 142)
C2 = (14, 143, 158)
PINK = (255, 141, 154)
TEAL = (125, 255, 224)
GOLD = (255, 211, 106)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def mix(c0, c1, t):
    return (lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t), 255)


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, size, pixels):
    raw = bytearray()
    row_w = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(pixels[y * row_w : (y + 1) * row_w])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    Path(path).write_bytes(png)
    print("wrote", Path(path).name, len(png), "bytes")


def fill_rect(px, size, x0, y0, x1, y1, color):
    x0, y0 = max(0, int(x0)), max(0, int(y0))
    x1, y1 = min(size, int(x1)), min(size, int(y1))
    r, g, b, a = color
    for y in range(y0, y1):
        row = y * size * 4
        for x in range(x0, x1):
            i = row + x * 4
            px[i : i + 4] = bytes((r, g, b, a))


def fill_round_rect(px, size, x0, y0, x1, y1, radius, color):
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    radius = max(0, int(radius))
    fill_rect(px, size, x0 + radius, y0, x1 - radius, y1, color)
    fill_rect(px, size, x0, y0 + radius, x1, y1 - radius, color)
    for cx, cy in (
        (x0 + radius, y0 + radius),
        (x1 - radius - 1, y0 + radius),
        (x0 + radius, y1 - radius - 1),
        (x1 - radius - 1, y1 - radius - 1),
    ):
        fill_circle(px, size, cx, cy, radius, color)


def fill_circle(px, size, cx, cy, radius, color):
    cx, cy, radius = int(cx), int(cy), int(radius)
    r2 = radius * radius
    r, g, b, a = color
    y0, y1 = max(0, cy - radius), min(size, cy + radius + 1)
    x0, x1 = max(0, cx - radius), min(size, cx + radius + 1)
    for y in range(y0, y1):
        dy = y - cy
        row = y * size * 4
        for x in range(x0, x1):
            dx = x - cx
            if dx * dx + dy * dy <= r2:
                i = row + x * 4
                px[i : i + 4] = bytes((r, g, b, a))


def gradient_bg(size):
    px = bytearray(size * size * 4)
    last = max(size - 1, 1)
    for y in range(size):
        t = y / last
        if t < 0.45:
            color = mix(C0, C1, t / 0.45)
        else:
            color = mix(C1, C2, (t - 0.45) / 0.55)
        row = y * size * 4
        for x in range(size):
            i = row + x * 4
            px[i : i + 4] = bytes(color)
    return px


def draw_card(px, size, inset):
    x0 = y0 = inset
    x1 = y1 = size - inset
    fill_round_rect(px, size, x0, y0, x1, y1, size * 0.12, (255, 255, 255, 230))
    inner = inset + size * 0.12
    bar_h = size * 0.08
    gap = size * 0.06
    start_y = size * 0.38
    colors = [PINK + (255,), TEAL + (255,), GOLD + (255,)]
    for i, color in enumerate(colors):
        y = start_y + i * (bar_h + gap)
        fill_round_rect(px, size, inner, y, size - inner, y + bar_h, bar_h / 2, color)


def make(size, path, maskable=False):
    px = gradient_bg(size)
    inset = size * (0.22 if maskable else 0.14)
    draw_card(px, size, inset)
    write_png(path, size, px)


def main():
    make(192, OUT / "icon-192.png")
    make(512, OUT / "icon-512.png")
    make(192, OUT / "icon-maskable-192.png", maskable=True)
    make(512, OUT / "icon-maskable-512.png", maskable=True)
    make(180, OUT / "apple-touch-icon.png")


if __name__ == "__main__":
    main()

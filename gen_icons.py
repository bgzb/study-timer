#!/usr/bin/env python3
"""生成托盘模板图标(16/32)与应用图标(512)，纯标准库实现。"""
import math
import struct
import zlib


def write_png(path, w, h, rgba_rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rgba_rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def downsample(rows, size, factor):
    out = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for dy in range(factor):
                for dx in range(factor):
                    p = rows[y * factor + dy]
                    i = (x * factor + dx) * 4
                    r += p[i]; g += p[i + 1]; b += p[i + 2]; a += p[i + 3]
            n = factor * factor
            row += bytes((r // n, g // n, b // n, a // n))
        out.append(row)
    return out


def smooth(v):
    return max(0.0, min(1.0, v))


def make_tray(size):
    """黑色模板图：实心圆盘 + 右侧楔形缺口（计时器造型）。"""
    ss = 4
    S = size * ss
    c = (S - 1) / 2
    r = S * 0.44
    rows = []
    for y in range(S):
        row = bytearray()
        for x in range(S):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            alpha = smooth(r - d + 1) if d < r + 1 else 0.0
            if d < r + 1:
                # 楔形缺口：朝右 ±36°
                ang = math.atan2(dy, dx)
                if -0.63 < ang < 0.63 and d > S * 0.12:
                    alpha = 0.0
            row += bytes((0, 0, 0, int(alpha * 255)))
        rows.append(row)
    return downsample(rows, size, ss)


def make_app_icon(size):
    """暖橙渐变圆角方块 + 白色表盘与指针。"""
    ss = 4
    S = size * ss
    rows = []
    for y in range(S):
        row = bytearray()
        for x in range(S):
            # 圆角方块遮罩
            rad = S * 0.22
            qx = max(rad - x, x - (S - 1 - rad), 0)
            qy = max(rad - y, y - (S - 1 - rad), 0)
            d = math.hypot(qx, qy)
            mask = smooth(1.5 - d)
            if mask <= 0:
                row += bytes((0, 0, 0, 0))
                continue
            # 垂直渐变 #f7b733 -> #e8743a
            t = y / (S - 1)
            r = int(247 + (232 - 247) * t)
            g = int(183 + (116 - 183) * t)
            b = int(51 + (58 - 51) * t)
            # 表盘：白色圆环
            cx = cy = (S - 1) / 2
            dx, dy = x - cx, y - cy
            dd = math.hypot(dx, dy)
            ring_out = S * 0.335
            ring_in = S * 0.295
            in_ring = ring_in < dd < ring_out
            on_ring_edge = smooth(ring_out - dd + 1.5) * smooth(dd - ring_in + 1.5)
            # 指针：12点方向(上)与3点方向(右)，长至环内缘
            hand_w = S * 0.032
            hand_len = S * 0.20
            hand = 0.0
            if -hand_w <= dx <= hand_w and -hand_len <= dy <= -S * 0.03:
                hand = smooth(hand_w - abs(dx) + 1)
            if -hand_w <= dy <= hand_w and S * 0.03 <= dx <= hand_len:
                hand = max(hand, smooth(hand_w - abs(dy) + 1))
            white = max(on_ring_edge, hand)
            if white > 0:
                r = int(r + (255 - r) * white)
                g = int(g + (255 - g) * white)
                b = int(b + (255 - b) * white)
            a = int(mask * 255)
            row += bytes((r, g, b, a))
        rows.append(row)
    return downsample(rows, size, ss)


if __name__ == '__main__':
    import os
    base = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(base, 'assets')
    os.makedirs(assets, exist_ok=True)
    write_png(os.path.join(assets, 'trayTemplate.png'), 16, 16, make_tray(16))
    write_png(os.path.join(assets, 'trayTemplate@2x.png'), 32, 32, make_tray(32))
    write_png(os.path.join(assets, 'icon.png'), 512, 512, make_app_icon(512))
    print('icons generated at', assets)

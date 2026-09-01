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


def dist_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    vv = vx * vx + vy * vy
    if vv == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / vv))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def make_tray(size):
    """黑色模板图：16px 下仍清晰的打开书页与节奏底线。"""
    ss = 4
    S = size * ss
    paths = [
        (0.20, 0.28, 0.49, 0.37), (0.20, 0.28, 0.20, 0.72),
        (0.20, 0.72, 0.49, 0.84), (0.49, 0.37, 0.49, 0.84),
        (0.51, 0.37, 0.80, 0.28), (0.80, 0.28, 0.80, 0.72),
        (0.80, 0.72, 0.51, 0.84), (0.51, 0.37, 0.51, 0.84),
        (0.19, 0.86, 0.81, 0.86),
    ]
    stroke = 0.075
    rows = []
    for y in range(S):
        row = bytearray()
        for x in range(S):
            px, py = x / (S - 1), y / (S - 1)
            d = min(dist_segment(px, py, *p) for p in paths)
            alpha = smooth((stroke - d) * S * 0.75)
            row += bytes((0, 0, 0, int(alpha * 255)))
        rows.append(row)
    return downsample(rows, size, ss)


def make_app_icon(size):
    """暖珊瑚圆角底 + 奶油书页 + 薄荷节奏线。"""
    ss = 4
    S = size * ss
    rows = []
    for y in range(S):
        row = bytearray()
        for x in range(S):
            px, py = x / (S - 1), y / (S - 1)
            # macOS 风格圆角方块遮罩
            rad = 0.225
            qx = max(rad - px, px - (1 - rad), 0)
            qy = max(rad - py, py - (1 - rad), 0)
            mask = smooth((rad - math.hypot(qx, qy)) * S + 1.0)
            if mask <= 0:
                row += bytes((0, 0, 0, 0))
                continue

            # 温暖但克制的珊瑚渐变
            t = py
            r = int(235 + (216 - 235) * t)
            g = int(143 + (96 - 143) * t)
            b = int(104 + (76 - 104) * t)

            # 打开的书：两页略向外张开，底边做柔和弧线
            left_bottom = 0.715 - 0.035 * ((px - 0.36) / 0.14) ** 2
            right_bottom = 0.715 - 0.035 * ((px - 0.64) / 0.14) ** 2
            edge = 0.0025
            left = (0.225 <= px <= 0.485 and 0.285 <= py <= left_bottom)
            right = (0.515 <= px <= 0.775 and 0.285 <= py <= right_bottom)
            page_alpha = 1.0 if left or right else 0.0
            # 轻微柔化书页外缘
            if not page_alpha:
                near_left = max(abs(px - 0.355) - 0.13, py - left_bottom, 0.285 - py)
                near_right = max(abs(px - 0.645) - 0.13, py - right_bottom, 0.285 - py)
                page_alpha = max(smooth((edge - near_left) * S), smooth((edge - near_right) * S))
            if page_alpha > 0:
                cream = (255, 248, 235)
                r = int(r + (cream[0] - r) * page_alpha)
                g = int(g + (cream[1] - g) * page_alpha)
                b = int(b + (cream[2] - b) * page_alpha)

            # 中缝保留一条背景色，让小尺寸仍能看出两页
            if abs(px - 0.5) < 0.014 and 0.29 < py < 0.72:
                seam = smooth((0.014 - abs(px - 0.5)) * S)
                r = int(r + (224 - r) * seam)
                g = int(g + (112 - g) * seam)
                b = int(b + (82 - b) * seam)

            # 薄荷色节奏线：连接两页，也表达专注/休息的循环
            if 0.225 <= px <= 0.775:
                curve_y = 0.785 + 0.018 * math.cos((px - 0.5) / 0.275 * math.pi)
                rhythm = smooth((0.016 - abs(py - curve_y)) * S)
                if rhythm > 0:
                    mint = (79, 171, 139)
                    r = int(r + (mint[0] - r) * rhythm)
                    g = int(g + (mint[1] - g) * rhythm)
                    b = int(b + (mint[2] - b) * rhythm)

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

"""
AFTER MOON 커버 이미지.

  python scripts/after-moon-cover.py  →  public/covers/after-moon.jpg

## 왜 스토리 포스터를 그대로 못 쓰나

**카드가 네 가지 비율로 자른다.** PartyCard 하나에 5:3 · 29:19 · 4:5 ·
1:1 이 다 있고 전부 object-cover 다. 1080x1920 세로 포스터를 넣으면
가로 카드에서 가운데 띠만 남아 제목과 날짜가 통째로 잘린다.

그래서 **5:3 으로 그리고, 글자는 가운데 720px 안에만 둔다.**

    1500 x 900 원본
    5:3   그대로
    29:19 위아래만 살짝
    1:1   가운데 900 폭   → x 300..1200
    4:5   가운데 720 폭   → x 390..1110   ← 제일 좁다. 이게 안전선이다

## 그림

포스터의 언어를 따른다 — 검은 바탕, 오른쪽 위의 달, 흐릿한 보케.
대화창은 안 넣는다. 카드 크기에서는 글씨가 뭉개져서 얼룩으로만 보인다.
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "public", "covers", "after-moon.jpg")

W, H = 1500, 900
SAFE = 720                      # 4:5 로 잘려도 남는 가운데 폭 (900 x 4/5)
# **안전폭을 꽉 채우면 안 된다.** 4:5 는 딱 720 이라, 720 에 맞춘 글자는
# 양 끝이 경계에 닿아 잘린 것처럼 보인다. 한 뼘 물러선다
TEXT_W = int(SAFE * 0.88)
CX = W / 2

BRAND = os.path.join(
    os.path.expanduser("~"), "blackout", "video", "assets", "Michroma-Regular.ttf"
)
KR = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
KR_BOLD_IDX, KR_REG_IDX = 6, 2


def kr(size, bold=False):
    return ImageFont.truetype(KR, size, index=KR_BOLD_IDX if bold else KR_REG_IDX)


def tmask(text, font, track=0.0):
    """자간을 준 글자 마스크. 브랜드 폰트는 자간이 넓어야 포스터와 같아 보인다"""
    tr = int(getattr(font, "size", 20) * track)
    ws = [font.getlength(c) for c in text]
    total = int(sum(ws) + tr * max(len(text) - 1, 0))
    asc, desc = font.getmetrics()
    im = Image.new("L", (total + 80, asc + desc + 60), 0)
    d = ImageDraw.Draw(im)
    x = 40
    for c, wc in zip(text, ws):
        d.text((x, 30), c, font=font, fill=255)
        x += wc + tr
    a = np.asarray(im)
    ys, xs = np.where(a > 0)
    return a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1].astype(np.float32) / 255.0


def fit(text, maker, target_w, track=0.0, cap=400):
    """폭에 맞는 크기를 이분탐색으로 찾는다"""
    lo, hi = 8, cap
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if tmask(text, maker(mid), track).shape[1] <= target_w:
            lo = mid
        else:
            hi = mid - 1
    return lo


def blit(dst, m, cx, cy, a=1.0, glow=0.0, glow_r=14):
    """더해서 얹는다. glow 는 번지게 한 같은 마스크를 밑에 한 겹 깐다"""
    layers = [(m, 1.0)]
    if glow > 0:
        pad = int(glow_r * 2) + 4
        mp = np.pad(m, pad)
        g = np.asarray(
            Image.fromarray((mp * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(glow_r)
            )
        ).astype(np.float32) / 255.0
        layers.insert(0, (g, glow))
    for lm, la in layers:
        h, w = lm.shape
        x0, y0 = int(cx - w / 2), int(cy - h / 2)
        sx0, sy0 = max(0, x0), max(0, y0)
        sx1, sy1 = min(W, x0 + w), min(H, y0 + h)
        if sx1 <= sx0 or sy1 <= sy0:
            continue
        dst[sy0:sy1, sx0:sx1] += (
            lm[sy0 - y0 : sy1 - y0, sx0 - x0 : sx1 - x0][..., None] * (a * la)
        )


def moon(img):
    """오른쪽 위의 달. **가장자리를 흐리게 해야 붙여 넣은 원처럼 안 보인다**"""
    mx, my, r = W * 0.850, H * 0.190, H * 0.205
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((xx - mx) ** 2 + (yy - my) ** 2)

    disc = np.clip((r - d) / (r * 0.055), 0, 1)

    # 크레이터. **얕고 크게, 몇 개만.** 작고 진한 점을 뿌리면 달이 아니라
    # 곰팡이로 보인다 — 카드 크기로 줄면 더 그렇다
    rng = np.random.default_rng(926)
    pit = np.zeros((H, W), np.float32)
    for _ in range(9):
        a = rng.uniform(0, 2 * np.pi)
        rr = r * np.sqrt(rng.uniform(0, 0.72))
        px, py = mx + rr * np.cos(a), my + rr * np.sin(a)
        pr = r * rng.uniform(0.16, 0.34)
        pit += np.clip(1 - np.sqrt((xx - px) ** 2 + (yy - py) ** 2) / pr, 0, 1) ** 2.2
    pit = np.clip(pit, 0, 1) * 0.13

    # 아래쪽으로 갈수록 어둡게 — 위에서 빛이 오는 것처럼
    shade = np.clip(1.0 - (yy - (my - r)) / (2 * r) * 0.55, 0, 1)

    face = disc * (0.60 * shade - pit)
    face = np.asarray(
        Image.fromarray((np.clip(face, 0, 1) * 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(3.0)
        )
    ).astype(np.float32) / 255.0

    halo = np.exp(-((d - r) / (r * 0.75)) ** 2) * 0.085 * (d > r)
    img += (face + halo)[..., None]


def bokeh(img):
    """
    흐릿한 빛망울. **속이 찬 원이어야 한다.**

    테두리만 그리면 도넛이 돼서 빛이 아니라 얼룩으로 보인다.
    가운데를 옅게 채우고 가장자리만 아주 살짝 밝힌다.
    """
    rng = np.random.default_rng(2609)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    for _ in range(7):
        bx, by = rng.uniform(0.02, 0.62) * W, rng.uniform(0.05, 0.95) * H
        br = rng.uniform(0.05, 0.13) * H
        d = np.sqrt((xx - bx) ** 2 + (yy - by) ** 2)
        disc = np.clip((br - d) / (br * 0.55), 0, 1) ** 1.4
        rim = np.exp(-((d - br * 0.92) / (br * 0.16)) ** 2) * 0.5
        img += ((disc + rim) * rng.uniform(0.008, 0.017))[..., None]


def main():
    # 완전한 검정이 아니라 아주 살짝 푸른 검정. 카드 배경과 붙어도 면이 산다
    img = np.zeros((H, W, 3), np.float32) + np.array([0.030, 0.031, 0.038])

    bokeh(img)
    moon(img)

    # ── 글자. 전부 가운데 SAFE 폭 안에 둔다 ──────────────────
    m = tmask("BLACKOUT CREW", ImageFont.truetype(BRAND, 22), 0.34)
    blit(img, m, CX, H * 0.235, 0.42)

    s = fit("AFTER MOON", lambda n: ImageFont.truetype(BRAND, n), TEXT_W, 0.10)
    blit(img, tmask("AFTER MOON", ImageFont.truetype(BRAND, s), 0.10),
         CX, H * 0.395, 0.97, glow=0.20, glow_r=18)

    s = fit("09.26 SAT", lambda n: ImageFont.truetype(BRAND, n), int(TEXT_W * 0.62), 0.06)
    blit(img, tmask("09.26 SAT", ImageFont.truetype(BRAND, s), 0.06),
         CX, H * 0.560, 0.93, glow=0.16, glow_r=15)

    blit(img, tmask("추석 연휴 마지막날", kr(30)), CX, H * 0.660, 0.55)

    # 얇은 선 하나. 정보 줄을 아래로 떼어 놓는다
    y, lw = int(H * 0.735), int(TEXT_W * 0.52)
    img[y : y + 1, int(CX - lw / 2) : int(CX + lw / 2)] += 0.24

    info = "22:00 — 02:10  ·  9,900원  ·  30명  ·  혼자 와도 됨"
    s = min(26, fit(info, lambda n: kr(n), TEXT_W))
    blit(img, tmask(info, kr(s)), CX, H * 0.810, 0.62)

    # 네 귀퉁이를 눌러 준다. 카드 모서리에서 글자가 뜨는 걸 막는다
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = 1.0 - 0.18 * (((xx / W - 0.5) * 2) ** 2 + ((yy / H - 0.5) * 2) ** 2) / 2
    img *= np.clip(v, 0, 1)[..., None]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(
        OUT, quality=90, subsampling=0
    )
    print(f"{OUT}  ({W}x{H})  {os.path.getsize(OUT)//1024} KB")


if __name__ == "__main__":
    main()

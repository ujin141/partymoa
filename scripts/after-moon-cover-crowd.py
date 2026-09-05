"""
AFTER MOON 커버 — 매장 영상 캡처 위에 이름.

  python scripts/after-moon-cover-crowd.py

public/covers/after-moon-crowd*.jpg 를 읽어 글자를 얹고 **같은 파일에
다시 쓴다.** 글자 없는 원본은 -raw.jpg 로 남긴다.

카드가 네 비율로 자른다. 4:5 가 제일 좁아서 가운데 720px(x 390..1110)
만 남는다. 글자는 전부 그 안에 둔다.

은색 글자와 자간 함수는 blackout 저장소의 포스터 대본에서 가져온다.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BLACKOUT = os.path.join(HERE, '..', '..', 'blackout', 'video')
sys.path.insert(0, BLACKOUT)
from poster_moon import metal, tracked, tracked_w  # noqa: E402

FONT = os.path.join(BLACKOUT, 'assets', 'Michroma-Regular.ttf')
COVERS = os.path.join(HERE, '..', 'public', 'covers')
W, H = 1500, 900
SAFE_W = 720
CX = W // 2


def silver(text, size, track):
    f = ImageFont.truetype(FONT, size)
    asc, desc = f.getmetrics()
    im = Image.new('L', (int(tracked_w(text, f, track)) + 24, asc + desc), 0)
    tracked(ImageDraw.Draw(im), (12, 0), text, f, track, 255)
    m = np.asarray(im)
    ys, xs = np.where(m > 0)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32) / 255.0
    return metal(*m.shape, m)


def fit(text, room, track, cap=200):
    for sz in range(cap, 30, -2):
        f = ImageFont.truetype(FONT, sz)
        if tracked_w(text, f, track) <= room:
            return sz
    return 30


def write(name):
    path = os.path.join(COVERS, f'{name}.jpg')
    raw = os.path.join(COVERS, f'{name}-raw.jpg')
    if not os.path.exists(raw):
        os.replace(path, raw)
    im = Image.open(raw).convert('RGB')
    a = np.asarray(im, np.float32) / 255.0

    # 글자 뒤를 조금 더 어둡게. 사진이 밝은 자리에 은색을 올리면 안 읽힌다
    yy = np.arange(H, dtype=np.float32)[:, None, None]
    a *= 1 - 0.34 * np.exp(-(((yy - H * 0.66) / (H * 0.17)) ** 2))
    pil = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
    d = ImageDraw.Draw(pil)

    size = fit('AFTER MOON', SAFE_W - 40, 0.10)
    mark = silver('AFTER MOON', size, 0.10)
    mh, mw = mark.shape[:2]
    y = int(H * 0.60 - mh / 2)

    fe = ImageFont.truetype(FONT, 22)
    we = tracked_w('BLACKOUT CREW', fe, 0.40)
    tracked(d, (CX - we / 2, y - 22 - 30), 'BLACKOUT CREW', fe, 0.40,
            (176, 179, 188, 255))

    pil.alpha_composite(
        Image.fromarray((np.clip(mark, 0, 1) * 255).astype(np.uint8), 'RGBA'),
        (CX - mw // 2, y))

    fd = ImageFont.truetype(FONT, 34)
    wd = tracked_w('09.26 SAT', fd, 0.12)
    tracked(d, (CX - wd / 2, y + mh + 22), '09.26 SAT', fd, 0.12,
            (236, 238, 244, 255))

    pil.convert('RGB').save(path, quality=90, optimize=True, progressive=True)
    print(path, '글자 크기', size)


if __name__ == '__main__':
    write('after-moon-crowd')
    write('after-moon-crowd-2')

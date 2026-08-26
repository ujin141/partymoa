"""
앱스토어에 올릴 스크린샷 만들기.

시뮬레이터에서 그대로 뽑은 그림은 화면일 뿐이라 목록에서 안 읽힌다.
사람들은 스토어에서 스크롤하며 **한 장에 한 줄**만 본다. 그래서 문구를
위에 크게 올리고, 화면은 아래에 얹는다.

  python3 scripts/store-shots.py

  screenshots/     원본 (6.9인치 1320x2868)
  screenshots-65/  원본 (6.5인치 1242x2688)
        ↓
  upload/69/  upload/65/   올릴 것

**원본은 안 건드린다.** 문구를 고치고 다시 돌리면 되게 둔다.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STORE = os.path.join(ROOT, "store", "ios")

FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
BOLD, MED = 8, 4                      # ttc 안의 굵기 — Bold / Medium

# 앱 아이콘의 그라디언트를 그대로 쓴다. 스토어 목록에서 아이콘과 같은
# 보라가 이어지면 우리 앱 줄이라는 게 한눈에 보인다
C_TOP, C_BOT = (91, 43, 232), (58, 16, 168)

# (파일, 큰 글씨, 작은 글씨)
SHOTS = [
    ("01-home",     "서울 파티,\n한 곳에서",      "흩어진 파티를 모아 봅니다"),
    ("02-explore",  "혼자 가도\n괜찮습니다",      "1인 환영 파티만 따로 모아서"),
    ("03-party",    "라인업부터\n입금 계좌까지",  "필요한 건 한 화면에"),
    ("04-booking",  "자리는\n서버가 잡습니다",    "마감된 자리가 다시 팔리지 않아요"),
    # 알림은 서버에 APNs 키가 들어가기 전까지 앱에서 "준비 중" 으로 뜬다.
    # 안 되는 걸 스토어에 걸 수는 없어서 오프라인 티켓으로 뒀다.
    # 키가 들어가면 05-alerts 를 다시 찍어 이 줄을 바꾸면 된다
    ("05-offline",  "신호가 끊겨도\n티켓은 보입니다",  "입구에서 예매번호를 못 보는 일이 없게"),
]


def gradient(w, h):
    """세로 그라디언트. 한 줄씩 그리면 느려서 작게 만들고 늘린다"""
    g = Image.new("RGB", (1, h))
    px = g.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(int(a + (b - a) * t) for a, b in zip(C_TOP, C_BOT))
    return g.resize((w, h), Image.BILINEAR)


def rounded(im, r):
    """모서리를 깎는다. 각진 스크린샷은 폰처럼 안 보인다"""
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], r, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def shadow(size, r, blur, spread):
    """그림자. 이게 없으면 화면이 배경에 붙어 보인다"""
    w, h = size
    pad = blur * 3
    s = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    ImageDraw.Draw(s).rounded_rectangle(
        [pad - spread, pad - spread, pad + w + spread, pad + h + spread], r, fill=170
    )
    return s.filter(ImageFilter.GaussianBlur(blur)), pad


def fit_lines(draw, lines, font_path, idx, start, max_w):
    """줄 중 제일 긴 것이 폭에 들어갈 때까지 줄인다"""
    size = start
    while size > 20:
        f = ImageFont.truetype(font_path, size, index=idx)
        if max(draw.textlength(l, font=f) for l in lines) <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(font_path, size, index=idx)


def compose(src_path, head, sub, out_path):
    shot = Image.open(src_path).convert("RGB")
    W, H = shot.size

    canvas = gradient(W, H)
    d = ImageDraw.Draw(canvas)
    M = int(W * 0.085)

    # ── 글씨 ─────────────────────────────────────────────
    lines = head.split("\n")
    f_head = fit_lines(d, lines, FONT, BOLD, int(W * 0.085), W - M * 2)
    f_sub = ImageFont.truetype(FONT, int(W * 0.036), index=MED)

    y = int(H * 0.062)
    for line in lines:
        d.text((M, y), line, font=f_head, fill=(255, 255, 255))
        y += int(f_head.size * 1.28)

    y += int(H * 0.006)
    d.text((M, y), sub, font=f_sub, fill=(228, 216, 255))

    # ── 화면 ─────────────────────────────────────────────
    # 아래로 흘려보낸다. 꽉 채우면 답답하고, 다 보이게 하면 작아진다
    sw = int(W * 0.80)
    sh = int(shot.height * sw / shot.width)
    small = shot.resize((sw, sh), Image.LANCZOS)
    r = int(sw * 0.055)

    top = int(H * 0.30)
    left = (W - sw) // 2

    sh_img, pad = shadow((sw, sh), r, int(W * 0.022), int(W * 0.004))
    canvas.paste(
        (20, 6, 70),
        (left - pad, top - pad + int(W * 0.012)),
        sh_img,
    )
    canvas.paste(small, (left, top), rounded(small, r))

    canvas.save(out_path, quality=95)
    return out_path


if __name__ == "__main__":
    for src_dir, out_dir in [("screenshots", "upload/69"), ("screenshots-65", "upload/65")]:
        s = os.path.join(STORE, src_dir)
        o = os.path.join(STORE, out_dir)
        if not os.path.isdir(s):
            print(f"건너뜀 — {s} 없음")
            continue
        os.makedirs(o, exist_ok=True)
        for name, head, sub in SHOTS:
            src = os.path.join(s, f"{name}.png")
            if not os.path.exists(src):
                print(f"  없음 {src}")
                continue
            p = compose(src, head, sub, os.path.join(o, f"{name}.png"))
            im = Image.open(p)
            print(f"  {out_dir}/{name}.png  {im.width}x{im.height}")

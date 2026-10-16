#!/usr/bin/env python3
"""Draw the illustrations the README tells the plugin with, in a light and a dark variant each.

    python3 docs/images/readme/build-readme-art.py

The README shows each one through <picture>, so the dark file is picked when the viewer's
theme is dark. Colours and the firefly come from the logo's generator, so a change to the
brand reaches these too. Every word is outlined, as the logo's wordmark is: an SVG shown through
<img> draws <text> in whatever font the viewer has. That needs fontTools and brotli (pip install
fonttools brotli) and the Inter the site installs (pnpm install in webapp/).

The words live in LABELS, keyed by the suffix of the README they appear in, and the drawing code
never spells one out: a translated README gets its pictures by adding a language there. Inter has
no CJK glyphs, so Japanese and Chinese fall back to Noto Sans, which the first run downloads.
"""
import hashlib
import importlib.util
import math
import os
import pathlib
import re
import sys
import urllib.request

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = pathlib.Path(__file__).resolve().parent
sys.dont_write_bytecode = True   # loading the logo generator must not leave a cache beside it
# Reads the logo generator's palette, firefly geometry and its font helpers (_kerning, _kern):
# renaming one there breaks this script, which only shows when it is run again.
_spec = importlib.util.spec_from_file_location("brand", OUT.parent / "logo/build-firefly-assets.py")
brand = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(brand)

# --- theme -------------------------------------------------------------------
# Warm neutrals and one lime hue, the same scale webapp/src/styles/tokens.css builds on.
# Backgrounds stay transparent: the picture sits on GitHub's own page colour.
THEMES = {
    "light": dict(
        tones=brand.LIGHT_BG, ink=brand.WORDMARK_INK["light"], muted="#78716C", faint="#A8A29E",
        card="#FFFFFF", sunken="#F5F4F1", line="#E3E0D6", accent="#456C0B", soft="#EBF6CF",
        console="#1F1E1D", console_ink="#F0EEE6", console_dim="#A8A29E", fail="#9B2C1A",
    ),
    "dark": dict(
        tones=brand.DARK_BG, ink=brand.WORDMARK_INK["dark"], muted="#A8A29E", faint="#78716C",
        card="#1A1C16", sunken="#22251D", line="#34372D", accent="#A3DC33", soft="#2A3A12",
        console="#0E100B", console_ink="#F0EEE6", console_dim="#8A847E", fail="#F08A74",
    ),
}

# --- fonts -------------------------------------------------------------------
# Each language is a chain of fonts, tried in order for every character: Inter for Latin, so the
# commands and file names look the same in every language, then a font for that script.
INTER = [brand.INTER.parent / f"inter-{subset}-wght-normal.woff2" for subset in ("latin", "vietnamese")]

# Noto Sans for Japanese and Simplified Chinese, from Google Fonts at a pinned commit and checked
# against a hash, kept in the user's cache rather than in the repository (10 and 17 MB).
GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts/1d0e46c7933245c8180fe83e47917961c913bbdb/ofl/"
NOTO = {
    "ja": ("notosansjp/NotoSansJP[wght].ttf", "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f"),
    "sc": ("notosanssc/NotoSansSC[wght].ttf", "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da"),
}
CACHE = pathlib.Path(os.environ.get("XDG_CACHE_HOME", pathlib.Path.home() / ".cache")) / "webapp-evidence/fonts"


def noto(script):
    path, sha = NOTO[script]
    file = CACHE / pathlib.Path(path).name
    if not file.exists():
        url = GOOGLE_FONTS + path.replace("[", "%5B").replace("]", "%5D")
        print("downloading", url)
        data = urllib.request.urlopen(url).read()
        if hashlib.sha256(data).hexdigest() != sha:
            raise SystemExit(f"{url} does not match its pinned hash")
        CACHE.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
    return file


FONTS = {
    "en": lambda: INTER,
    "vi-VN": lambda: INTER,
    "ja-JP": lambda: INTER + [noto("ja")],
    "zh-Hans": lambda: INTER + [noto("sc")],
}

# The colour the recorder's menu bar item lights its lantern with while a take records, read from
# the item itself so the picture shows what a person actually sees on their own screen.
STATUS_ITEM = OUT.parents[2] / "src/skills/recording/scripts/status-item.js"
_light = re.search(r"recording: '(#[0-9A-Fa-f]{6})'", STATUS_ITEM.read_text())
if not _light:
    raise SystemExit(f"{STATUS_ITEM}: the recording colour in LIGHT was not found")
RECORDING = _light.group(1)

# Its rays flash once a second, half on and half off, as the menu bar item's do. A viewer who asked
# for less motion gets the light held on.
BLINK = ("<style>@keyframes rec{50%{opacity:0}}.rec{animation:rec 1s steps(1,end) infinite}"
         "@media (prefers-reduced-motion:reduce){.rec{animation:none}}</style>")

# --- words -------------------------------------------------------------------
LABELS = {
    "en": dict(
        flow_title="Describe the flow",
        flow_sub="in any language, or an MR link",
        flow_steps=("Open the orders page", "Create an order", "Check that it saved"),
        drive_title="The agent drives Chrome",
        drive_sub="a visible pointer, real typing",
        rec="REC",
        url="app.example.com/orders",
        get_title="You get the proof",
        get_sub="ready to attach to a PR or ticket",
        files=(("evidence.mp4", "the take"), ("01.png  02.png  03.png", "every main step"),
               ("evidence-runbook.md", "times, commands, errors")),
        form_heading="New order",
        form_fields=(("SKU", "ABC"), ("Quantity", "2")),
        form_button="Create order",
        term_lines=(("$ curl -X POST /api/orders", "cmd"), ("HTTP 201 in 0.184s", "ok"),
                    ("$ psql -c 'select * from orders'", "cmd"), ("1042   ABC   2   created", "out")),
        proofs=(("SCREEN", "filled in by a pointer", "at the pace a viewer reads"),
                ("ENDPOINT", "called with the browser's", "own session, status asserted"),
                ("DATABASE", "the row it wrote, in frame", "beside the screen that made it")),
        uat=(("Write the criteria", "plain steps, any language"),
             ("Record one take", "a wrong status stops it"),
             ("Read the runbook", "each step has a timestamp"),
             ("Sign off", "check times, don't re-run")),
        uat_back="after a fix:  record that again",
        traits=(("Moves like a person", "a gliding pointer, uneven typing"),
                ("Edited after you watch", "sped up, cut, a value covered"),
                ("Sees what you missed", "console errors, failed requests"),
                ("Stays on your machine", "no service, no bot account")),
        edit_chips=("2×", "cut", "blur"),
        error_lines=("GET /api/me", "401"),
        platforms_title="Runs inside the agent you already use",
        platforms=("Claude Code", "Cursor", "Codex", "Gemini CLI", "Antigravity"),
        # what a screen reader says for each picture
        alt=dict(
            pipeline="Describe a flow, the agent drives Chrome, and a video, screenshots and a runbook come back",
            proofs="One take showing the screen, the endpoint called with the browser's session, and the database row",
            uat="Write the criteria, record one take, read the runbook, sign off; after a fix, record it again",
            traits="Moves like a person, edited after you watch, catches console errors, stays on your machine",
            platforms="Runs in Claude Code, Cursor, Codex, Gemini CLI and Antigravity",
        ),
    ),
    "vi-VN": dict(
        flow_title="Mô tả luồng",
        flow_sub="ngôn ngữ nào cũng được, hoặc một link MR",
        flow_steps=("Mở trang đơn hàng", "Tạo một đơn hàng", "Kiểm tra đơn đã lưu"),
        drive_title="Agent lái Chrome",
        drive_sub="con trỏ nhìn thấy được, gõ phím thật",
        rec="REC",
        url="app.example.com/orders",
        get_title="Bạn nhận về bằng chứng",
        get_sub="đính thẳng vào PR hoặc ticket",
        files=(("evidence.mp4", "bản quay"), ("01.png  02.png  03.png", "từng bước chính"),
               ("evidence-runbook.md", "thời điểm, lệnh, lỗi")),
        form_heading="Đơn hàng mới",
        form_fields=(("SKU", "ABC"), ("Số lượng", "2")),
        form_button="Tạo đơn",
        term_lines=(("$ curl -X POST /api/orders", "cmd"), ("HTTP 201 in 0.184s", "ok"),
                    ("$ psql -c 'select * from orders'", "cmd"), ("1042   ABC   2   created", "out")),
        proofs=(("MÀN HÌNH", "con trỏ điền và submit form", "ở nhịp đủ chậm để người xem đọc kịp"),
                ("ENDPOINT", "gọi bằng đúng session", "của trình duyệt, có assert status"),
                ("DATABASE", "dòng vừa ghi xuống database", "cùng khung với màn hình tạo ra nó")),
        uat=(("Viết tiêu chí", "lời thường, tiếng nào cũng được"),
             ("Quay một lần", "status sai là dừng ngay"),
             ("Đọc runbook", "mỗi bước gắn mốc thời gian"),
             ("Duyệt", "đối chiếu mốc, khỏi chạy lại")),
        uat_back="sửa xong:  record that again",
        traits=(("Như người thật thao tác", "gõ lúc nhanh lúc chậm"),
                ("Quay xong vẫn sửa được", "tua nhanh, cắt, che một giá trị"),
                ("Thấy chỗ bạn bỏ sót", "lỗi console, request thất bại"),
                ("Chạy trên máy bạn", "không service ngoài, không bot")),
        edit_chips=("2×", "cắt", "che"),
        error_lines=("GET /api/me", "401"),
        platforms_title="Chạy ngay trong agent bạn đang dùng",
        platforms=("Claude Code", "Cursor", "Codex", "Gemini CLI", "Antigravity"),
        alt=dict(
            pipeline="Mô tả luồng, agent lái Chrome, rồi trả về video, screenshot và runbook",
            proofs="Một bản quay cho thấy màn hình, endpoint gọi bằng session của trình duyệt, và dòng trong database",
            uat="Viết tiêu chí, quay một lần, đọc runbook, duyệt; sửa xong thì quay lại",
            traits="Như người thật thao tác, quay xong vẫn sửa được, bắt lỗi console, chạy trên máy bạn",
            platforms="Chạy trong Claude Code, Cursor, Codex, Gemini CLI và Antigravity",
        ),
    ),
    "ja-JP": dict(
        flow_title="フローを伝える",
        flow_sub="どの言語でも、MR のリンクでも",
        flow_steps=("注文ページを開く", "注文を作成する", "保存されたか確認する"),
        drive_title="エージェントが Chrome を操作",
        drive_sub="見えるポインター、本物のタイピング",
        rec="REC",
        url="app.example.com/orders",
        get_title="証拠が返ってくる",
        get_sub="PR やチケットにそのまま添付",
        files=(("evidence.mp4", "テイク本体"), ("01.png  02.png  03.png", "主要ステップごと"),
               ("evidence-runbook.md", "時刻・コマンド・エラー")),
        form_heading="新規注文",
        form_fields=(("SKU", "ABC"), ("数量", "2")),
        form_button="注文を作成",
        term_lines=(("$ curl -X POST /api/orders", "cmd"), ("HTTP 201 in 0.184s", "ok"),
                    ("$ psql -c 'select * from orders'", "cmd"), ("1042   ABC   2   created", "out")),
        proofs=(("画面", "ポインターが入力する", "見る人が読める速さで"),
                ("エンドポイント", "ブラウザー自身のセッションで", "呼び、ステータスを検証"),
                ("データベース", "書き込まれた行を", "それを作った画面の隣に")),
        uat=(("基準を書く", "普段の言葉で、どの言語でも"),
             ("1 テイク録画", "誤ったステータスで停止"),
             ("runbook を読む", "各ステップに時刻つき"),
             ("承認する", "時刻と照合、再実行なし")),
        uat_back="修正後:  record that again",
        traits=(("人が操作したように", "滑らかなポインター、自然な入力"),
                ("見てから直せる", "加速・カット・値を隠す"),
                ("見落としを拾う", "コンソールエラー、失敗した通信"),
                ("マシンの外に出ない", "サービスもボットも不要")),
        edit_chips=("2×", "カット", "隠す"),
        error_lines=("GET /api/me", "401"),
        platforms_title="いつものエージェントの中で動きます",
        platforms=("Claude Code", "Cursor", "Codex", "Gemini CLI", "Antigravity"),
        alt=dict(
            pipeline="フローを伝えると、エージェントが Chrome を操作し、動画・スクリーンショット・runbook が返ってくる",
            proofs="1 つのテイクに、画面、ブラウザーのセッションで呼んだエンドポイント、データベースの行",
            uat="基準を書き、1 テイク録画し、runbook を読み、承認する。修正後はもう一度録画",
            traits="人が操作したように動き、見てから直せ、コンソールエラーを拾い、マシンの外に出ない",
            platforms="Claude Code、Cursor、Codex、Gemini CLI、Antigravity で動きます",
        ),
    ),
    "zh-Hans": dict(
        flow_title="描述流程",
        flow_sub="任何语言都行，或一个 MR 链接",
        flow_steps=("打开订单页面", "创建一个订单", "确认已经保存"),
        drive_title="agent 驱动 Chrome",
        drive_sub="看得见的指针，真实的键入",
        rec="REC",
        url="app.example.com/orders",
        get_title="拿回证据",
        get_sub="直接附到 PR 或工单上",
        files=(("evidence.mp4", "录制本身"), ("01.png  02.png  03.png", "每个关键步骤"),
               ("evidence-runbook.md", "时间、命令、错误")),
        form_heading="新建订单",
        form_fields=(("SKU", "ABC"), ("数量", "2")),
        form_button="创建订单",
        term_lines=(("$ curl -X POST /api/orders", "cmd"), ("HTTP 201 in 0.184s", "ok"),
                    ("$ psql -c 'select * from orders'", "cmd"), ("1042   ABC   2   created", "out")),
        proofs=(("页面", "由指针填写", "按观看者读得过来的节奏"),
                ("接口", "用浏览器自己的会话调用", "并断言状态码"),
                ("数据库", "它写入的那一行", "就在创建它的页面旁边")),
        uat=(("写下标准", "普通的话，任何语言"),
             ("录制一次", "状态码不对就停止"),
             ("读 runbook", "每一步都有时间戳"),
             ("签字验收", "对照时间，不必重跑")),
        uat_back="修复后:  record that again",
        traits=(("像人在操作", "指针滑动，键入不均匀"),
                ("看完再改", "加速、剪掉、遮住某个值"),
                ("发现你漏看的", "控制台错误、失败的请求"),
                ("不离开你的机器", "没有服务，没有机器人账号")),
        edit_chips=("2×", "剪掉", "遮住"),
        error_lines=("GET /api/me", "401"),
        platforms_title="就在你已经在用的 agent 里运行",
        platforms=("Claude Code", "Cursor", "Codex", "Gemini CLI", "Antigravity"),
        alt=dict(
            pipeline="描述流程，agent 驱动 Chrome，交回视频、截图和 runbook",
            proofs="一次录制里有页面、用浏览器会话调用的接口，以及数据库里的那一行",
            uat="写下标准，录制一次，读 runbook，签字验收；修复后再录一次",
            traits="像人在操作，看完再改，发现控制台错误，不离开你的机器",
            platforms="在 Claude Code、Cursor、Codex、Gemini CLI 和 Antigravity 中运行",
        ),
    ),
}


# --- drawing primitives ------------------------------------------------------
class Pen:
    """Outlines text and collects SVG elements for one picture in one theme."""

    def __init__(self, lang, theme):
        self.lang, self.c, self.parts, self.glyphs, self.blinks = lang, THEMES[theme], [], {}, False
        self.tones = self.c["tones"]

    @staticmethod
    def font(file, weight, cache={}):
        """One font at one weight, with what laying out text in it needs."""
        key = (file, weight)
        if key not in cache:
            font = instantiateVariableFont(TTFont(file), {"wght": weight})
            cache[key] = dict(file=file, font=font, cmap=font.getBestCmap(), glyphs=font.getGlyphSet(),
                              em=font["head"].unitsPerEm, kerning=brand._kerning(font))
        return cache[key]

    def layout(self, text, size, weight, tracking):
        """Where each glyph of `text` goes, as (font, glyph name, x, scale), and the total width.
        Each character takes the first font in the language's chain that has it."""
        chain = [self.font(file, weight) for file in FONTS[self.lang]()]
        placed, x, prev = [], 0.0, None
        for ch in text:
            f = next((f for f in chain if ord(ch) in f["cmap"]), None)
            if not f:
                raise SystemExit(f"{ch!r} in {text!r} has no glyph in any font for {self.lang}")
            name, scale = f["cmap"][ord(ch)], size / f["em"]
            if prev and prev[0] is f:
                x += brand._kern(f["font"], prev[1], name, f["kerning"]) * scale
            placed.append((f, name, x, scale))
            x += f["glyphs"][name].width * scale + tracking
            prev = (f, name)
        return placed, x - tracking

    def measure(self, text, size, weight=400, tracking=0.0):
        return self.layout(text, size, weight, tracking)[1]

    def text(self, text, x, y, size=14, weight=400, fill="ink", anchor="start", tracking=0.0, fit=None):
        """Outline `text` at a baseline. `fit` is the room it has: a translation that runs
        longer stops the build instead of spilling out of its card."""
        placed, width = self.layout(text, size, weight, tracking)
        if fit and width > fit:
            raise SystemExit(f"{self.lang}: {text!r} is {width:.0f} wide, the space for it is {fit}")
        x -= {"start": 0, "middle": width / 2, "end": width}[anchor]
        # Each glyph is drawn once, in font units, and placed with <use>: a picture repeats the
        # same few letters hundreds of times, and inlining every outline made each file ~400 KB.
        uses = []
        for f, name, dx, scale in placed:
            ref = self.glyph(f, weight, name)
            if ref:
                uses.append(f'<use href="#{ref}" transform="translate({x + dx:.2f} {y}) scale({scale:.5f} {-scale:.5f})"/>')
        self.add(f'<g fill="{self.color(fill)}">{"".join(uses)}</g>')
        return width

    def glyph(self, f, weight, name):
        key = (f["file"], weight, name)
        if key not in self.glyphs:
            pen = SVGPathPen(f["glyphs"], ntos=lambda v: f"{v:.0f}")
            f["glyphs"][name].draw(pen)
            self.glyphs[key] = (f"g{len(self.glyphs)}", pen.getCommands())
        ref, d = self.glyphs[key]
        return ref if d else None

    def caps(self, text, x, y, fill="muted", anchor="start", size=10.5):
        return self.text(text, x, y, size, 600, fill, anchor, tracking=1.3)

    def color(self, key):
        return self.c.get(key) or self.tones.get(key) or key

    def add(self, element):
        self.parts.append(element)

    def rect(self, x, y, w, h, r=0, fill="card", stroke=None, width=1, dash=None):
        s = f' stroke="{self.color(stroke)}" stroke-width="{width}"' if stroke else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{self.color(fill)}"{s}{d}/>')

    def card(self, x, y, w, h, r=14):
        self.rect(x, y, w, h, r, "card", "line")

    def circle(self, cx, cy, r, fill="none", stroke=None, width=1.5):
        s = f' stroke="{self.color(stroke)}" stroke-width="{width}"' if stroke else ""
        self.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{self.color(fill)}"{s}/>')

    def line(self, d, stroke="line", width=1.5, dash=None, fill="none"):
        dd = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<path d="{d}" fill="{self.color(fill)}" stroke="{self.color(stroke)}" '
                 f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{dd}/>')

    def arrow(self, x1, y1, x2, y2, stroke="accent"):
        self.line(f"M{x1} {y1} L{x2} {y2}", stroke, 1.6)
        a, k = math.atan2(y2 - y1, x2 - x1), 7
        p = [(x2 - k * math.cos(a - s), y2 - k * math.sin(a - s)) for s in (0.45, -0.45)]
        self.line(f"M{p[0][0]:.1f} {p[0][1]:.1f} L{x2} {y2} L{p[1][0]:.1f} {p[1][1]:.1f}", stroke, 1.6)

    def check(self, cx, cy, s=1.0, stroke="accent"):
        self.line(f"M{cx - 4 * s} {cy} L{cx - 1 * s} {cy + 3 * s} L{cx + 5 * s} {cy - 4 * s}", stroke, 1.8)

    def pointer(self, x, y, s=1.0):
        pts = [(0, 0), (0, 17), (4.5, 13), (7.5, 20), (10, 19), (7, 12.5), (13, 12.5)]
        d = "M" + " L".join(f"{x + px * s:.1f} {y + py * s:.1f}" for px, py in pts) + " Z"
        self.add(f'<path d="{d}" fill="{self.color("ink")}" stroke="{self.color("card")}" '
                 f'stroke-width="1.4" stroke-linejoin="round"/>')

    def firefly(self, x, y, size):
        k = size / 128
        self.add(f'<g transform="translate({x} {y}) scale({k:.4f})">{brand.full_mark(self.tones)}</g>')

    def lantern(self, cx, cy, r, recording=False):
        """The logo's record dot with its light breaking outward, at any size. `recording` lights
        it the way the menu bar item does while a take records: red, its rays flashing."""
        k = r / brand.LANTERN["r"]
        dot, glow = (RECORDING, RECORDING) if recording else (self.tones["light"], self.tones["pale"])
        rays = "".join(brand.polygon(brand.ray(a), glow) for a in brand.GLOW_ANGLES)
        if recording:
            self.blinks = True
            rays = f'<g class="rec">{rays}</g>'
        self.add(f'<g transform="translate({cx} {cy}) scale({k:.3f}) '
                 f'translate({-brand.LANTERN["cx"]} {-brand.LANTERN["cy"]})">'
                 + brand.polygon(brand.ngon(**brand.LANTERN), dot) + rays + "</g>")

    def window(self, x, y, w, h, url=None):
        """A browser window: chrome bar, three dots, an address pill."""
        self.rect(x, y, w, h, 12, "card", "line")
        self.add(f'<path d="M{x + 12} {y} H{x + w - 12} A12 12 0 0 1 {x + w} {y + 12} V{y + 30} '
                 f'H{x} V{y + 12} A12 12 0 0 1 {x + 12} {y} Z" fill="{self.color("sunken")}"/>')
        self.line(f"M{x} {y + 30} H{x + w}", "line", 1)
        for i in range(3):
            self.circle(x + 16 + i * 12, y + 15, 3.5, "line")
        if url:
            self.rect(x + 58, y + 7, w - 116, 16, 8, "card")
            self.text(url, x + w / 2, y + 19, 10, 400, "muted", "middle")

    def svg(self, w, h, label):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" '
                f'height="{h}" role="img" aria-label="{label}">\n  <defs>'
                + "".join(f'<path id="{ref}" d="{d}"/>' for ref, d in self.glyphs.values() if d)
                + "</defs>" + (BLINK if self.blinks else "") + "\n  " + "\n  ".join(self.parts) + "\n</svg>\n")


# --- the pictures --------------------------------------------------------------
def pipeline(p, L):
    """Request in, the agent at the wheel, three files out."""
    W, H, top, ch = 960, 280, 16, 196
    cols = (40, 360, 680)

    # what the user types
    x = cols[0]
    p.card(x, top, 240, ch)
    p.rect(x + 18, top + 20, 204, 28, 8, "soft")
    p.text("/webapp-evidence:recording", x + 30, top + 39, 12, 500, "accent")
    for i, step in enumerate(L["flow_steps"]):
        y = top + 82 + i * 36
        p.circle(x + 30, y - 4, 10, "sunken")
        p.text(str(i + 1), x + 30, y, 11, 600, "accent", "middle")
        p.text(step, x + 50, y, 13, 400, "ink", fit=176)

    # the browser, driven
    x = cols[1]
    p.window(x, top, 240, ch, L["url"])
    p.lantern(x + 202, top + 52, 5.5, recording=True)
    p.caps(L["rec"], x + 186, top + 56, RECORDING, "end", 9.5)
    p.rect(x + 22, top + 68, 120, 9, 4.5, "line")
    for i in range(2):
        p.rect(x + 22, top + 90 + i * 30, 196, 22, 6, "card", "line")
    p.rect(x + 22, top + 154, 92, 24, 7, "accent")
    # the pointer's path: travelling, easing in, not jumping
    p.line(f"M{x + 226} {top + 70} C{x + 180} {top + 150} {x + 120} {top + 128} {x + 92} {top + 162}",
           "faint", 1.4, "2 5")
    p.pointer(x + 90, top + 160, 1.05)

    # what comes back
    x = cols[2]
    p.card(x, top, 240, ch)
    icons = ("video", "shots", "doc")
    for i, ((name, note), icon) in enumerate(zip(L["files"], icons)):
        y = top + 22 + i * 58
        p.rect(x + 18, y, 40, 40, 10, "sunken")
        if icon == "video":
            p.add(f'<path d="M{x + 33} {y + 12} L{x + 47} {y + 20} L{x + 33} {y + 28} Z" fill="{p.color("accent")}"/>')
        elif icon == "shots":
            for j in range(3):
                p.rect(x + 25 + j * 4, y + 13 + j * 3, 18, 13, 2.5, "card", "accent", 1.3)
        else:
            p.rect(x + 28, y + 9, 20, 23, 3, "card", "accent", 1.3)
            for j in range(3):
                p.line(f"M{x + 32} {y + 16 + j * 5} H{x + 44 - (j == 2) * 5}", "accent", 1.3)
        p.text(name, x + 72, y + 18, 12.5, 500, "ink", fit=156)
        p.text(note, x + 72, y + 34, 11.5, 400, "muted", fit=156)

    for a in (cols[0] + 240, cols[1] + 240):
        p.arrow(a + 14, top + ch / 2, a + 66, top + ch / 2)

    titles = ((L["flow_title"], L["flow_sub"]), (L["drive_title"], L["drive_sub"]),
              (L["get_title"], L["get_sub"]))
    for x, (title, sub) in zip(cols, titles):
        p.text(title, x + 120, top + ch + 36, 16, 600, "ink", "middle", fit=300)
        p.text(sub, x + 120, top + ch + 58, 12.5, 400, "muted", "middle", fit=300)
    return W, H


def proofs(p, L):
    """One take, three layers: the page, the endpoint under it, the row it wrote."""
    W, H = 960, 380
    bx, by, bw, bh = 40, 24, 560, 332
    p.window(bx, by, bw, bh, L["url"])

    # the page
    fx = bx + 40
    p.text(L["form_heading"], fx, by + 74, 17, 600, "ink")
    for i, (label, value) in enumerate(L["form_fields"]):
        x = fx + i * 170
        p.text(label, x, by + 102, 11, 500, "muted", fit=150)
        p.rect(x, by + 110, 150, 30, 7, "card", "line")
        p.text(value, x + 12, by + 130, 13, 400, "ink")
    bt = p.measure(L["form_button"], 12.5, 600) + 32
    p.rect(fx + 340, by + 110, bt, 30, 8, "accent")
    p.text(L["form_button"], fx + 340 + bt / 2, by + 130, 12.5, 600, "card", "middle", fit=bx + bw - fx - 380)
    p.pointer(fx + 340 + bt - 8, by + 134, 1.0)

    # the terminal panel the take opens over the page
    tx, ty, tw, th = bx + 20, by + 168, bw - 40, 146
    p.rect(tx, ty, tw, th, 10, "console")
    for i in range(3):
        p.circle(tx + 16 + i * 11, ty + 14, 3, "console_dim")
    for i, (text, kind) in enumerate(L["term_lines"]):
        y = ty + 46 + i * 26
        fill = {"cmd": "console_ink", "ok": "pale", "out": "console_dim"}[kind]
        x = tx + 20
        if kind == "ok":
            p.check(x + 4, y - 4, 1.0, "pale")
            x += 18
        p.text(text, x, y, 12.5, 500 if kind != "out" else 400, fill)

    # the three callouts, each led to what it names
    targets = (by + 125, ty + 64, ty + 116)
    ax = 668
    for i, ((cap, a, b), ty_) in enumerate(zip(L["proofs"], targets)):
        y = (by + 70, by + 186, by + 280)[i]
        edge = fx + 340 + bt + 8 if i == 0 else tx + tw - 8
        p.line(f"M{edge} {ty_} H{ax - 40} C{ax - 26} {ty_} {ax - 26} {y - 4} {ax - 14} {y - 4}", "accent", 1.2, "1 4")
        p.circle(edge, ty_, 3.2, "accent")
        p.lantern(ax - 2, y - 4, 4)
        p.caps(cap, ax + 12, y, "accent")
        p.text(a, ax + 12, y + 22, 13.5, 500, "ink", fit=W - ax - 16)
        p.text(b, ax + 12, y + 41, 13.5, 400, "muted", fit=W - ax - 16)
    return W, H


def uat(p, L):
    """Criteria in, a signed-off take out, and the loop back after a fix."""
    W, H, cy, r = 960, 236, 112, 34
    xs = (135, 365, 595, 825)
    # the way back: from sign-off to a new take
    p.line(f"M{xs[3]} {cy - r - 8} C{xs[3]} {cy - 100} {xs[1]} {cy - 100} {xs[1]} {cy - r - 8}",
           "faint", 1.3, "3 5")
    p.arrow(xs[1], cy - r - 9.5, xs[1], cy - r - 8, "faint")
    back = L["uat_back"]
    bw = p.measure(back, 12, 500) + 28
    p.rect((xs[1] + xs[3]) / 2 - bw / 2, cy - 98, bw, 26, 13, "card", "line")
    p.text(back, (xs[1] + xs[3]) / 2, cy - 81, 12, 500, "muted", "middle")

    for i, x in enumerate(xs):
        last = i == 3
        p.circle(x, cy, r, "soft" if last else "card", "accent" if last else "line", 1.5)
        if i < 3:
            p.arrow(x + r + 14, cy, xs[i + 1] - r - 14, cy)
        if i == 0:
            for j in range(3):
                p.circle(x - 11, cy - 10 + j * 10, 2, "accent")
                p.line(f"M{x - 4} {cy - 10 + j * 10} H{x + 13 - (j == 2) * 6}", "accent", 1.6)
        elif i == 1:
            p.lantern(x, cy - 2, 9, recording=True)
        elif i == 2:
            for j in range(3):
                p.text(f"00:{(5, 24, 58)[j]:02d}", x - 18, cy - 6 + j * 11, 8.5, 600, "accent")
                p.line(f"M{x + 10} {cy - 9 + j * 11} H{x + 19}", "accent", 1.4)
        else:
            p.check(x, cy + 1, 2.2, "accent")
        title, sub = L["uat"][i]
        p.text(title, x, cy + r + 34, 15, 600, "ink", "middle", fit=220)
        p.text(sub, x, cy + r + 54, 12.5, 400, "muted", "middle", fit=220)
    return W, H


def traits(p, L):
    """Four tiles, each a small drawing of one thing the take does on its own."""
    W, H, tw, th, gap = 960, 226, 210, 214, 20
    x0 = (W - 4 * tw - 3 * gap) / 2
    for i, (title, sub) in enumerate(L["traits"]):
        x, y = x0 + i * (tw + gap), 6
        p.card(x, y, tw, th)
        p.rect(x + 16, y + 16, tw - 32, 120, 10, "sunken")
        cx, cy = x + tw / 2, y + 76
        if i == 0:
            # a pointer that travelled, and text typed at an uneven pace
            p.line(f"M{cx - 66} {cy + 38} C{cx - 50} {cy - 30} {cx + 10} {cy + 34} {cx + 34} {cy - 12}",
                   "faint", 1.4, "2 5")
            p.pointer(cx + 32, cy - 14, 1.1)
            p.rect(cx - 70, cy - 42, 92, 22, 6, "card", "line")
            for j, w in enumerate((7, 7, 7, 7, 7)):
                p.rect(cx - 62 + j * 11 + (j > 2) * 3, cy - 35, w, 8, 2, "accent" if j < 4 else "line")
            p.line(f"M{cx - 2} {cy - 37} V{cy - 25}", "accent", 1.5)
        elif i == 1:
            # a timeline, edited in place
            p.rect(cx - 72, cy - 4, 144, 8, 4, "line")
            p.rect(cx - 72, cy - 4, 40, 8, 4, "accent")
            p.add(f'<rect x="{cx - 20}" y="{cy - 4}" width="26" height="8" fill="{p.color("sunken")}"/>')
            p.line(f"M{cx - 20} {cy - 10} V{cy + 10} M{cx + 6} {cy - 10} V{cy + 10}", "accent", 1.4, "2 3")
            chips = [(chip, p.measure(chip, 11, 600) + 18) for chip in L["edit_chips"]]
            xx = cx - (sum(w for _, w in chips) + 8 * (len(chips) - 1)) / 2
            if xx < x + 22:
                raise SystemExit(f"{p.lang}: the edit chips do not fit their tile")
            for chip, w in chips:
                p.rect(xx, cy + 20, w, 22, 11, "card", "line")
                p.text(chip, xx + w / 2, cy + 35, 11, 600, "accent", "middle")
                xx += w + 8
            p.rect(cx + 24, cy - 40, 48, 18, 5, "card", "line")
            for j in range(4):
                p.rect(cx + 29 + j * 10, cy - 35, 8, 8, 1.5, "faint")
        elif i == 2:
            # a console line nobody was watching, caught
            p.rect(cx - 74, cy - 38, 148, 76, 8, "console")
            path, status = L["error_lines"]
            p.text(path, cx - 62, cy - 12, 11, 500, "console_ink")
            p.rect(cx + 28, cy - 25, 34, 18, 5, "fail")
            p.text(status, cx + 45, cy - 12, 10.5, 600, "console", "middle")
            p.rect(cx - 62, cy + 6, 90, 6, 3, "console_dim")
            p.rect(cx - 62, cy + 20, 60, 6, 3, "console_dim")
        else:
            # a laptop, and a cloud it never talks to
            lx = cx - 18
            p.rect(lx - 40, cy - 22, 80, 52, 6, "card", "ink", 1.5)
            p.line(f"M{lx - 54} {cy + 36} H{lx + 54}", "ink", 2)
            p.lantern(lx, cy + 3, 6)
            p.line(f"M{cx + 30} {cy - 24} a9 9 0 0 1 12 -12 a12 12 0 0 1 22 4 a8 8 0 0 1 0 16 h-30 a7 7 0 0 1 -4 -8 Z",
                   "faint", 1.4)
            p.line(f"M{cx + 34} {cy - 40} L{cx + 62} {cy - 6}", "faint", 1.6)
        p.text(title, x + 18, y + 168, 15, 600, "ink", fit=tw - 30)
        p.text(sub, x + 18, y + 190, 11.5, 400, "muted", fit=tw - 30)
    return W, H


def platforms(p, L):
    """The five agents it installs into, as a quiet row of names."""
    W, H = 960, 96
    p.caps(L["platforms_title"].upper(), W / 2, 22, "muted", "middle")
    names = L["platforms"]
    widths = [p.measure(n, 14, 500) + 40 for n in names]
    if sum(widths) + 14 * (len(names) - 1) > W - 40:
        raise SystemExit(f"{p.lang}: the agent names do not fit one row")
    x = (W - sum(widths) - 14 * (len(names) - 1)) / 2
    for name, w in zip(names, widths):
        p.rect(x, 40, w, 38, 19, "card", "line")
        p.circle(x + 18, 59, 3.5, "light")
        p.text(name, x + 28, 64, 14, 500, "ink")
        x += w + 14
    return W, H


PICTURES = {"pipeline": pipeline, "proofs": proofs, "uat": uat, "traits": traits, "platforms": platforms}


def main():
    for lang, labels in LABELS.items():
        suffix = "" if lang == "en" else f".{lang}"
        for name, draw in PICTURES.items():
            for theme in THEMES:
                pen = Pen(lang, theme)
                w, h = draw(pen, labels)
                file = f"{name}{suffix}{'-dark' if theme == 'dark' else ''}.svg"
                (OUT / file).write_text(pen.svg(w, h, labels["alt"][name]))
                print("wrote", file)


if __name__ == "__main__":
    main()

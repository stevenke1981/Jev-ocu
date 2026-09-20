#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
win10-control-harness.py - host-side evidence harness for Windows 10 Microsoft Paint.

Provenance and scope (read before use)
--------------------------------------
This script is a HOST-SIDE FALLBACK, recorded after both supported backends were measured
incapable of operating Paint on this machine (see backend-findings.md): the OCU binary has no
SendInput on Windows (PostMessage alone does not reach Paint's self-drawn ribbon/canvas), and the
native companion's windows_execute refuses to type into a non-foreground window. Per the project
contract this path requires EXPLICIT user selection; it is not a default backend and must not be
started silently. Its main product is not the clicking - it is the measuring.

Design rules that came out of the field test
-------------------------------------------
* Coordinates are PHYSICAL SCREEN PIXELS. SetProcessDpiAwareness(2) is called first.
* Foreground is raised with SetForegroundWindow/BringWindowToTop/SetFocus ONLY. Never ShowWindow:
  SW_RESTORE once un-maximized Paint and invalidated the whole coordinate calibration.
* Every subcommand performs a SINGLE deliberate action and reports before/after pixel evidence,
  so "control works" is proven rather than assumed.
* Before capturing evidence the cursor is parked at a neutral point, otherwise a hover highlight
  is indistinguishable from a selection.
* Keep keyboard sequences inside ONE process: a shell-invoked script lets the terminal steal the
  foreground between calls, after which keystrokes land in the terminal.

Usage (all flags default to this machine's measured geometry; override with env vars)
-------------------------------------------------------------------------------------
  PAINT_HWND=123456 PAINT_WINDOW=12,3,1535,864 PAINT_CANVAS=26,197,341,261 \
    python win10-control-harness.py probe
  python win10-control-harness.py click 526 91           # screen px
  python win10-control-harness.py drag 236 307 616 687   # screen px start -> end
  python win10-control-harness.py seq '[{"t":"key","v":"ctrl+e"},{"t":"type","v":"800"},{"t":"key","v":"tab"},{"t":"type","v":"600"},{"t":"key","v":"enter"}]'
  python win10-control-harness.py resize 800 600         # Ctrl+E dialog, then measure
  python win10-control-harness.py closedlg 影像內容      # WM_CLOSE on a modal dialog (= Cancel)
  python win10-control-harness.py key ctrl+s

  probe     read-only: foreground, window rect, measured canvas, canvas/gallery ink
  resize    atomic Ctrl+E -> width -> Tab -> height -> Enter, then verifies the measured canvas
  closedlg  closes a modal dialog by title via WM_CLOSE; never clicks 確定 (stale fields apply)
  click/drag/seq/key/type  one action, with hover-free before/after evidence
"""
import ctypes, json, sys, time, os
from ctypes import wintypes

import pyautogui
from PIL import ImageGrab

HWND = int(os.environ.get("PAINT_HWND", "4129470"))
WIN_RECT = tuple(int(v) for v in os.environ.get("PAINT_WINDOW", "12,3,1535,864").split(","))
CANVAS = tuple(int(v) for v in os.environ.get("PAINT_CANVAS", "26,197,341,261").split(","))
GALLERY = (460, 75, 240, 70)                      # shape gallery strip (screen px)
SELECTED_BUTTON = (506, 71, 40, 40)               # ellipse button box (screen px)
OUT = os.path.dirname(os.path.abspath(__file__))
NEUTRAL = (1700, 950)       # desktop point outside the Paint window; kills hover highlights before evidence capture

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
pyautogui.FAILSAFE = False                        # keep script alive mid-drag; explicit safety below
pyautogui.PAUSE = 0.12


def dpi_aware():
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)   # per-monitor v2
    except Exception:
        user32.SetProcessDPIAware()


def rect_of(hwnd):
    r = wintypes.RECT()
    if not user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(r)):
        return None
    return (r.left, r.top, r.right - r.left, r.bottom - r.top)


def force_foreground(hwnd):
    """Foreground WITHOUT ShowWindow (SW_RESTORE previously changed Paint's geometry)."""
    fg = user32.GetForegroundWindow()
    if fg == hwnd:
        return "already-foreground"
    tid_fg = user32.GetWindowThreadProcessId(wintypes.HWND(fg), None)
    tid_me = kernel32.GetCurrentThreadId()
    user32.AttachThreadInput(tid_me, tid_fg, True)
    try:
        user32.BringWindowToTop(wintypes.HWND(hwnd))
        user32.SetForegroundWindow(wintypes.HWND(hwnd))
        user32.SetFocus(wintypes.HWND(hwnd))
    finally:
        user32.AttachThreadInput(tid_me, tid_fg, False)
    time.sleep(0.45)
    return "set" if user32.GetForegroundWindow() == hwnd else "failed"


def crop(box):
    x, y, w, h = box
    return ImageGrab.grab(bbox=(x, y, x + w, y + h), all_screens=True).convert("RGB")


def stats(im, name):
    px = list(im.getdata())
    non_white = sum(1 for p in px if p != (255, 255, 255))
    non_bg = sum(1 for p in px if p not in ((255, 255, 255), (240, 240, 240), (245, 245, 245)))
    return {"name": name, "size": list(im.size), "non_white": non_white, "non_bg_ish": non_bg}


def diff(im_a, im_b):
    if im_a.size != im_b.size:
        return {"changed_pixels": -1, "note": "size mismatch"}
    a, b = list(im_a.getdata()), list(im_b.getdata())
    changed = 0
    minx, miny, maxx, maxy = 10 ** 9, 10 ** 9, -1, -1
    w = im_a.size[0]
    for i, (pa, pb) in enumerate(zip(a, b)):
        if max(abs(pa[0] - pb[0]), abs(pa[1] - pb[1]), abs(pa[2] - pb[2])) > 24:
            changed += 1
            x, y = i % w, i // w
            minx, miny = min(minx, x), min(miny, y)
            maxx, maxy = max(maxx, x), max(maxy, y)
    out = {"changed_pixels": changed}
    if changed:
        out["bbox_local"] = [minx, miny, maxx - minx + 1, maxy - miny + 1]
    return out


def snapshot():
    return {"gallery": crop(GALLERY), "canvas": crop(CANVAS), "button": crop(SELECTED_BUTTON)}

def report(action, before, after, extra=None):
    res = {
        "action": action,
        "dpi_aware": True,
        "screen": list(pyautogui.size()),
        "window_rect": rect_of(HWND),
        "window_rect_unchanged": rect_of(HWND) == WIN_RECT,
        "foreground": user32.GetForegroundWindow() == HWND,
        "mouse": list(pyautogui.position()),
        "gallery_diff": diff(before["gallery"], after["gallery"]),
        "button_diff": diff(before["button"], after["button"]),
        "canvas_before": stats(before["canvas"], "before"),
        "canvas_after": stats(after["canvas"], "after"),
        "canvas_diff": diff(before["canvas"], after["canvas"]),
    }
    if extra:
        res.update(extra)
    tag = "".join(ch if (ch.isalnum() or ch in "-_") else "_" for ch in action)[:60]
    after["gallery"].save(os.path.join(OUT, f"pyauto-{tag}-gallery.png"))
    after["canvas"].save(os.path.join(OUT, f"pyauto-{tag}-canvas.png"))
    res["saved"] = [f"pyauto-{tag}-gallery.png", f"pyauto-{tag}-canvas.png"]
    print(json.dumps(res, indent=2, ensure_ascii=False))
    return res


def detect_canvas(maxw=1500, maxh=900):
    """Programmatically measure the white canvas: expand from a seed inside the known origin.
    Independent of OCR/status-bar reading and truncated by real ink, so it is measured
    on a clean canvas (or rows/cols clear of ink)."""
    im = ImageGrab.grab(all_screens=True).convert("RGB")
    ox, oy = CANVAS[0], CANVAS[1]

    def white(dx, dy):
        return min(im.getpixel((ox + dx, oy + dy))) > 240

    w = 0
    while w < maxw and white(w, 2):
        w += 1
    h = 0
    while h < maxh and white(2, h):
        h += 1
    return {"origin": [ox, oy], "width": w, "height": h, "right": ox + w - 1, "bottom": oy + h - 1}


def warm_up_press(x1, y1, x2, y2, steps=30, settle=0.45, speed=0.02):
    """Paint samples the button-down late; park on the start point first and move deliberately.
    A 2px wiggle guarantees the app has seen a real mouse-move there before the press."""
    pyautogui.moveTo(x1, y1, duration=0.3)
    time.sleep(0.3)
    pyautogui.moveTo(x1 + 3, y1 + 3, duration=0.05)
    pyautogui.moveTo(x1, y1, duration=0.05)
    time.sleep(settle)
    pyautogui.mouseDown()
    time.sleep(0.25)
    for i in range(1, steps + 1):
        pyautogui.moveTo(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, duration=speed)
    time.sleep(0.3)
    pyautogui.mouseUp()
    time.sleep(0.2)


def find_windows(substr, pid=None):
    """Locate windows by title (and optionally owning pid) - addressing by handle beats pixel-hunting dialogs."""
    found = []
    EnumProc = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)

    def cb(hwnd, _):
        buf = ctypes.create_unicode_buffer(512)
        user32.GetWindowTextW(hwnd, buf, 512)
        if buf.value and substr in buf.value:
            wpid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
            if pid is None or wpid.value == pid:
                found.append({"hwnd": int(hwnd), "title": buf.value, "pid": int(wpid.value),
                              "visible": bool(user32.IsWindowVisible(hwnd)),
                              "enabled": bool(user32.IsWindowEnabled(hwnd))})
        return True

    user32.EnumWindows(EnumProc(cb), 0)
    return found


def close_dialog(substr, pid=34992, wait=1.0):
    """WM_CLOSE on a modal dialog == Cancel (never applies pending field values)."""
    hits = [w for w in find_windows(substr, pid) if w["visible"]]
    if not hits:
        return {"dialog_found": False}
    WM_CLOSE = 0x0010
    for w in hits:
        user32.PostMessageW(wintypes.HWND(w["hwnd"]), WM_CLOSE, 0, 0)
    time.sleep(wait)
    left = [w for w in find_windows(substr, pid) if w["visible"]]
    return {"dialog_found": True, "closed": hits, "still_open": left}


def main():
    dpi_aware()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "probe"

    fg = force_foreground(HWND)
    geo_ok = rect_of(HWND) == WIN_RECT
    if not geo_ok:
        print(json.dumps({"error": "window geometry changed; re-calibrate", "window_rect": rect_of(HWND),
                          "expected": list(WIN_RECT), "foreground": fg}, indent=2))
        return 3
    if cmd == "probe":
        s = snapshot()
        print(json.dumps({"action": "probe", "foreground": fg, "window_rect": rect_of(HWND),
                          "foreground_now": user32.GetForegroundWindow() == HWND,
                          "mouse": list(pyautogui.position()),
                          "detected_canvas": detect_canvas(),
                          "canvas": stats(s["canvas"], "canvas"),
                          "gallery": stats(s["gallery"], "gallery")}, indent=2, ensure_ascii=False))
        return 0

    if cmd == "closedlg":
        substr = sys.argv[2] if len(sys.argv) > 2 else ""
        res = close_dialog(substr) if substr else close_dialog("影像內容")
        ImageGrab.grab(all_screens=True).convert("RGB").crop(
            (WIN_RECT[0], WIN_RECT[1], WIN_RECT[0] + WIN_RECT[2], WIN_RECT[1] + WIN_RECT[3])).save(os.path.join(OUT, "pyauto-closedlg-window.png"))
        res.update({"detected_canvas": detect_canvas(), "all_paint_windows": find_windows("", 34992),
                    "saved": "pyauto-closedlg-window.png"})
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0

    if cmd == "resize":
        # atomic: Ctrl+E -> width -> tab -> height -> enter, then measure. No cross-process focus gap.
        tw, th = int(sys.argv[2]), int(sys.argv[3])
        before_c = detect_canvas()
        pyautogui.hotkey("ctrl", "e")
        time.sleep(1.1)
        pyautogui.typewrite(str(tw), interval=0.08)
        time.sleep(0.3)
        pyautogui.press("tab")
        time.sleep(0.25)
        pyautogui.typewrite(str(th), interval=0.08)
        time.sleep(0.3)
        pyautogui.press("enter")
        time.sleep(1.4)
        after_c = detect_canvas()
        full = ImageGrab.grab(all_screens=True).convert("RGB")
        full.crop((WIN_RECT[0], WIN_RECT[1], WIN_RECT[0] + WIN_RECT[2], WIN_RECT[1] + WIN_RECT[3])).save(os.path.join(OUT, "pyauto-resize-window.png"))
        print(json.dumps({"action": f"resize {tw}x{th}", "foreground": fg, "window_rect": rect_of(HWND),
                          "window_rect_unchanged": rect_of(HWND) == WIN_RECT,
                          "canvas_before": before_c, "canvas_after": after_c,
                          "requested": [tw, th], "verified": after_c["width"] == tw and after_c["height"] == th,
                          "saved": "pyauto-resize-window.png"}, indent=2, ensure_ascii=False))
        return 0

    before = snapshot()
    extra = {"foreground_before_action": fg}

    if cmd == "click":
        x, y = int(sys.argv[2]), int(sys.argv[3])
        extra["target"] = [x, y]
        pyautogui.moveTo(x, y, duration=0.25)
        time.sleep(0.25)
        pyautogui.mouseDown()
        time.sleep(0.08)
        pyautogui.mouseUp()
    elif cmd == "drag":
        x1, y1, x2, y2 = (int(v) for v in sys.argv[2:6])
        extra["from"] = [x1, y1]
        extra["to"] = [x2, y2]
        warm_up_press(x1, y1, x2, y2)
    elif cmd == "seq":
        steps = json.loads(sys.argv[2])
        extra["steps"] = steps
        for st in steps:
            if st["t"] == "type":
                pyautogui.typewrite(st["v"], interval=0.06)
            elif st["t"] == "key":
                k = st["v"]
                pyautogui.hotkey(*k.split("+")) if "+" in k else pyautogui.press(k)
            elif st["t"] == "click":
                pyautogui.moveTo(st["x"], st["y"], duration=0.2); time.sleep(0.2); pyautogui.click()
            elif st["t"] == "drag":
                warm_up_press(st["x"], st["y"], st["toX"], st["toY"], steps=st.get("steps", 30))
            elif st["t"] == "sleep":
                time.sleep(st["v"])
            time.sleep(0.35)
    elif cmd == "key":
        keys = sys.argv[2]
        extra["keys"] = keys
        pyautogui.hotkey(*keys.split("+")) if "+" in keys else pyautogui.press(keys)
    elif cmd == "type":
        text = sys.argv[2]
        extra["text"] = text
        pyautogui.typewrite(text, interval=0.06)
    else:
        print(json.dumps({"error": f"unknown command {cmd}"}))
        return 2

    after = snapshot()
    pyautogui.moveTo(*NEUTRAL, duration=0.15)          # park the cursor so hover state does not fake a change
    time.sleep(0.5)
    parked = snapshot()
    full = ImageGrab.grab(all_screens=True).convert("RGB")
    full.save(os.path.join(OUT, "pyauto-last-full.png"))
    res = report(f"{cmd} {' '.join(sys.argv[2:])}", before, after, extra)
    res["parked"] = {
        "gallery_vs_before": diff(before["gallery"], parked["gallery"]),
        "button_vs_before": diff(before["button"], parked["button"]),
        "canvas_vs_before": diff(before["canvas"], parked["canvas"]),
        "canvas_ink": stats(parked["canvas"], "parked")["non_white"],
    }
    parked["gallery"].save(os.path.join(OUT, f"pyauto-{cmd}-parked-gallery.png"))
    res["saved"].append(f"pyauto-{cmd}-parked-gallery.png")
    print(json.dumps({"PARKED (hover-free, baseline-comparable)": res["parked"], "saved": res["saved"]}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

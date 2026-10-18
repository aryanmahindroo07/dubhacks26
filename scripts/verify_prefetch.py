"""Browser check for the customer workspace prefetching.

Start the backend (npm start in backend/) and the frontend (npm run dev in
frontend/, port 5173), then run:

    pip install playwright && playwright install chromium
    python scripts/verify_prefetch.py [output_dir]

Use a fresh backend: the model learns from every click, and the checks expect
the starting training data. Writes verify.json and workspace.png to output_dir.
"""
import json, re, sys, time
from collections import Counter
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
results = {"checks": [], "console_errors": [], "browser_api_requests": []}

def check(name, ok, detail=""):
    results["checks"].append({"check": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 1600})
    page.on("console", lambda m: m.type == "error" and results["console_errors"].append(m.text))
    page.on("pageerror", lambda e: results["console_errors"].append(str(e)))
    page.on("request", lambda r: "/api/" in r.url and results["browser_api_requests"].append(
        f"{r.method} {r.url.split('5173')[1]}"))

    page.goto("http://localhost:5173/")
    ws = page.locator("#customers")
    metrics = lambda: ws.locator("text=Prefetch started").inner_text()
    latest = lambda: ws.locator("text=Latest:").inner_text()

    # Journey 1: open a customer, wait for the prefetch, then open Orders.
    ws.get_by_role("button", name="Load customers").click()
    ws.get_by_role("button", name="Acme Corp").click()
    page.wait_for_selector("#customers >> text=acme", timeout=10000)  # profile email loaded
    page.wait_for_function(
        "() => /Completed: 1\\b/.test(document.querySelector('#customers').innerText)", timeout=10000)
    ws.get_by_role("button", name="Orders").click()
    page.wait_for_selector("#customers >> text=Latest: ORDERS", timeout=10000)
    j1 = latest()
    check("Journey 1: Orders served from cache after waiting for prefetch", "Cache hit" in j1, j1)
    wait_ms = float(re.search(r"Wait: ([\d.]+)", j1).group(1))
    check("Journey 1: Orders wait well under the 1,200 ms delay", wait_ms < 100, f"{wait_ms} ms")
    time.sleep(2.5)
    m = metrics()
    check("Policy: no prefetch after Orders (all candidates ~17%)", re.search(r"started: 1\b", m), m)

    # Journey 2: open a customer and click Orders immediately, while the prefetch is still running.
    ws.get_by_role("button", name="Load customers").click()
    ws.get_by_role("button", name="Globex").click()
    page.wait_for_selector("#customers >> text=globex", timeout=10000)
    ws.get_by_role("button", name="Orders").click()
    page.wait_for_selector("#customers >> text=Latest: ORDERS", timeout=10000)
    j2 = latest()
    check("Journey 2: fast click joins the running prefetch", "Reused running request" in j2, j2)
    time.sleep(2.5)

    hit_line = ws.locator("text=Cache hits:").inner_text()
    results["hit_line"] = hit_line
    check("Hit-rate line reports reuse separately", "Reused running requests: 1" in hit_line, hit_line)
    results["final_metrics"] = metrics()
    page.screenshot(path=OUT + "/workspace.png", full_page=True)
    browser.close()

gets = Counter(r for r in results["browser_api_requests"] if r.startswith("GET"))
results["browser_get_counts"] = dict(gets)
dupes = {k: v for k, v in gets.items() if v > 1}
check("No duplicate data requests from the browser", not dupes, json.dumps(dupes) if dupes else "each URL fetched once")
check("No console errors", not results["console_errors"], "; ".join(results["console_errors"])[:300])
json.dump(results, open(OUT + "/verify.json", "w"), indent=2)

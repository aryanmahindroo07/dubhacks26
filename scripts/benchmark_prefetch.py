"""OFF/ON benchmark for predictive prefetching.

Runs the same customer journeys twice in headless Chromium on /overview:
first with prefetch paused (no prediction calls, no speculative requests),
then with prefetch on. Uses the page's real Pause/Resume button.

Start a FRESH backend (npm start in backend/; the model learns from every
click) and the frontend (npm run dev in frontend/, port 5173), then:

    pip install playwright && playwright install chromium
    python scripts/benchmark_prefetch.py [--think-ms 1500] [--out results]

Writes benchmark.json and benchmark.md to --out. Numbers include the
backend's artificial 1,200 ms delay and use generated mock records, and the
journeys follow the same patterns as the synthetic training data, so they
show how the system behaves on familiar journeys, not real-world savings.
"""
import argparse, json, statistics, time
from pathlib import Path
from playwright.sync_api import sync_playwright

# (customer, steps after opening the profile). Each journey uses a new customer
# so no cached data carries over. Mix: 5 Orders-first, 2 Support, 3 Analytics.
JOURNEYS = [
    ("Acme Corp", ["Orders"]),
    ("Globex", ["Support"]),
    ("Initech", ["Orders"]),
    ("Umbrella Labs", ["Analytics"]),
    ("Stark Industries", ["Orders", "Profile", "Analytics"]),
    ("Wayne Enterprises", ["Orders"]),
    ("Hooli", ["Support"]),
    ("Pied Piper", ["Analytics", "Profile", "Support"]),
    ("Vandelay Imports", ["Orders"]),
    ("Soylent Co", ["Analytics"]),
]

METRICS = "() => window.__requestflow.getPrefetchMetrics()"


def run_mode(browser, base, prefetch_on, think_ms):
    page = browser.new_page()
    page.goto(base + "/overview")
    page.wait_for_function("() => !!window.__requestflow")
    button = page.get_by_role("button", name="Pause prefetch")
    if not prefetch_on:
        button.click()
    enabled = page.evaluate("() => window.__requestflow.isPrefetchEnabled()")
    assert enabled == prefetch_on, "pause button did not set the prefetch mode"
    ws = page.locator("#customers")

    def navigate(click):
        count = page.evaluate(METRICS)["navigations"]
        click()
        page.wait_for_function(f"() => window.__requestflow.getPrefetchMetrics().navigations > {count}")
        page.wait_for_function("() => document.querySelector('#customers [aria-busy]').getAttribute('aria-busy') === 'false'")
        page.wait_for_timeout(think_ms)

    for customer, steps in JOURNEYS:
        navigate(lambda: ws.get_by_role("button", name="Load customers").click())
        navigate(lambda c=customer: ws.get_by_role("button", name=c, exact=True).click())
        for step in steps:
            navigate(lambda s=step: ws.get_by_role("button", name=s, exact=True).click())

    page.wait_for_timeout(2500)  # let trailing prefetches finish
    m = page.evaluate(METRICS)
    page.close()
    navs = [e for e in reversed(m["requestLog"]) if e["kind"] == "navigation"]
    detail = [e["waitMs"] for e in navs if e["stateId"] not in ("CUSTOMERS", "CUSTOMER")]
    return {
        "prefetch": "on" if prefetch_on else "off",
        "navigations": m["navigations"],
        "total_wait_s": round(m["totalWaitMs"] / 1000, 2),
        "median_wait_ms": round(m["medianWaitMs"], 1),
        "detail_pages": len(detail),
        "detail_median_wait_ms": round(statistics.median(detail), 1) if detail else 0,
        "detail_total_wait_s": round(sum(detail) / 1000, 2),
        "detail_fast": sum(1 for ms in detail if ms < 100),
        "data_gets": m["dataRequests"],
        "demand_gets": m["demandRequests"],
        "speculative_gets": m["speculativeRequests"],
        "useful_prefetches": m["usefulPrefetches"],
        "unused_prefetches": m["unusedPrefetches"] + m["failed"],
        "prediction_calls": m["predictionCalls"],
        "cache_hits": m["hits"],
        "joined_running": m["reused"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:5173")
    ap.add_argument("--think-ms", type=int, default=1500,
                    help="pause after each page loads before the next click")
    ap.add_argument("--out", default=".")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        started = time.time()
        off = run_mode(browser, args.base, False, args.think_ms)
        on = run_mode(browser, args.base, True, args.think_ms)
        browser.close()

    rows = [
        ("Navigations", "navigations", ""),
        ("Total waiting, all pages", "total_wait_s", " s"),
        ("Median wait, all pages", "median_wait_ms", " ms"),
        ("Total waiting, Orders/Support/Analytics", "detail_total_wait_s", " s"),
        ("Median wait, Orders/Support/Analytics", "detail_median_wait_ms", " ms"),
        ("Orders/Support/Analytics under 100 ms", "detail_fast", f" of {on['detail_pages']}"),
        ("Data GETs sent", "data_gets", ""),
        ("· demanded by the user", "demand_gets", ""),
        ("· speculative (prefetch)", "speculative_gets", ""),
        ("Useful prefetches", "useful_prefetches", ""),
        ("Unused or failed prefetches", "unused_prefetches", ""),
        ("Prediction calls (POST)", "prediction_calls", ""),
    ]
    lines = [
        f"# Prefetch OFF vs ON ({len(JOURNEYS)} journeys, {args.think_ms} ms think time)",
        "",
        "| Measure | OFF | ON |",
        "|---|---:|---:|",
    ]
    for label, key, unit in rows:
        lines.append(f"| {label} | {off[key]}{unit} | {on[key]}{unit} |")
    saved = off["total_wait_s"] - on["total_wait_s"]
    extra_gets = on["data_gets"] - off["data_gets"]
    lines += [
        "",
        f"Waiting saved: {saved:.2f} s ({saved / off['total_wait_s'] * 100:.0f}% of OFF). "
        f"Cost: {extra_gets:+d} data GETs and {on['prediction_calls']} prediction calls.",
        "",
        "Mock records, 1,200 ms artificial backend delay, journeys that follow the "
        "synthetic training patterns. Fresh backend; OFF run first (it sends no "
        "prediction calls, so it does not train the model).",
    ]
    report = "\n".join(lines)
    print(report)
    (out / "benchmark.md").write_text(report + "\n")
    (out / "benchmark.json").write_text(json.dumps(
        {"think_ms": args.think_ms, "journeys": JOURNEYS, "off": off, "on": on,
         "runtime_s": round(time.time() - started, 1)}, indent=2))


if __name__ == "__main__":
    main()

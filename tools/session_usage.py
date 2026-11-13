#!/usr/bin/env python3
"""Token use of one Claude Code session, and what it would cost at Claude API list prices.

    python3 -I tools/session_usage.py <transcript-dir-or-jsonl> [--json]

Reads the session transcript (<id>.jsonl) and every *.jsonl under <id>/ (subagents, workflows). Each API response
is counted once (by requestId / message id), with its `usage` as the API reported it. Prices are list prices per
million tokens from the claude-api reference bundled with Claude Code (cached 2026-11-03); cache writes cost 1.25x the
input price with the 5-minute TTL and 2x with the 1-hour TTL, cache reads are billed at the listed read price.

The result is an API-equivalent figure, not an invoice: a session on a claude.ai subscription is billed by the plan.
Prices are per model id; a model without a row is reported with tokens only and cost "sem preço".

Estimated activity follows docs/ESFORCO-E-CUSTOS.md: the gaps between consecutive responses that produced output,
each capped at five minutes, joined without overlap across the session and its workflows. It is an estimate of
session activity, not human hours, GPU time or continuous work.
"""
import collections, glob, json, os, sys
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

# USD per million tokens: input, output, cache read. Source: claude-api reference (Current Models, cached 2026-11-03),
# shared/prompt-caching.md (Economics). Fast mode is left out on purpose: the reference gives its input/output price
# but not its cache-read price, so a fast-mode row is reported as "sem preço" instead of a guessed figure.
PRICES = {
    ("claude-opus-5-5", "standard"): {"input": Decimal("4.00"), "output": Decimal("20.00"), "cache_read": Decimal("0.20")},
    # same reference, shared/models.md (read 2026-11-13): $8 / $40, cache reads $0.20, writes $10 (5 min) and $16 (1 h),
    # which are the 1.25x and 2x of the input price used below
    ("claude-fable-5-2", "standard"): {"input": Decimal("8.00"), "output": Decimal("40.00"), "cache_read": Decimal("0.20")},
}
WRITE_5M, WRITE_1H = Decimal("1.25"), Decimal("2")
MTOK = Decimal(1_000_000)
ACTIVITY_CAP_S = 300            # docs/ESFORCO-E-CUSTOS.md: intervals between token increments, capped at five minutes


def active_seconds(stamps):
    """Union of [t_i, min(t_{i+1}, t_i + cap)] over the sorted response times, in seconds."""
    ts = sorted(stamps)
    total, start, end = 0.0, None, None
    for a, b in zip(ts, ts[1:]):
        if b <= a:
            continue
        lo, hi = a, min(b, a + ACTIVITY_CAP_S)
        if start is None:
            start, end = lo, hi
        elif lo <= end:
            end = max(end, hi)
        else:
            total += end - start
            start, end = lo, hi
    if start is not None:
        total += end - start
    return total


def transcripts(path):
    if path.endswith(".jsonl"):
        root = path[: -len(".jsonl")]
        files = [path]
    else:
        root = path.rstrip("/")
        files = [root + ".jsonl"] if os.path.exists(root + ".jsonl") else []
    files += sorted(glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True))
    return [f for f in files if os.path.basename(f) != "journal.jsonl"], root


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    files, root = transcripts(args[0])
    seen, rows, first, last, stamps = set(), collections.defaultdict(collections.Counter), None, None, []
    for f in files:
        group = "principal" if f == root + ".jsonl" else ("workflow" if "/workflows/" in f else "subagente")
        for line in open(f, encoding="utf-8"):
            try:
                e = json.loads(line)
            except ValueError:
                continue
            m = e.get("message") or {}
            u = m.get("usage")
            if e.get("type") != "assistant" or not u:
                continue
            key = e.get("requestId") or m.get("id") or (f, e.get("uuid"))
            if key in seen:
                continue
            seen.add(key)
            speed = u.get("speed") or "standard"
            r = rows[(group, m.get("model", "?"), speed)]
            r["respostas"] += 1
            r["input"] += int(u.get("input_tokens") or 0)
            r["output"] += int(u.get("output_tokens") or 0)
            r["cache_read"] += int(u.get("cache_read_input_tokens") or 0)
            cc = u.get("cache_creation") or {}
            w5, w1 = int(cc.get("ephemeral_5m_input_tokens") or 0), int(cc.get("ephemeral_1h_input_tokens") or 0)
            total_w = int(u.get("cache_creation_input_tokens") or 0)
            r["cache_write_5m"] += w5
            r["cache_write_1h"] += w1
            r["cache_write_sem_ttl"] += max(0, total_w - w5 - w1)   # reported without a TTL split: priced as 1h (upper bound)
            ts = e.get("timestamp")
            if ts:
                first, last = min(first or ts, ts), max(last or ts, ts)
                if int(u.get("output_tokens") or 0) > 0:
                    stamps.append(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp())
    out, grand = [], Decimal(0)
    for (group, model, speed), r in sorted(rows.items()):
        p = PRICES.get((model, speed))
        cost = None
        if p:
            cost = (r["input"] * p["input"] + r["output"] * p["output"] + r["cache_read"] * p["cache_read"]
                    + r["cache_write_5m"] * p["input"] * WRITE_5M
                    + (r["cache_write_1h"] + r["cache_write_sem_ttl"]) * p["input"] * WRITE_1H) / MTOK
            cost = cost.quantize(Decimal("0.01"), ROUND_HALF_UP)
            grand += cost
        out.append({"grupo": group, "modelo": model, "velocidade": speed, **r, "usd_equivalente_api": str(cost) if cost is not None else "sem preço"})
    hours = round(active_seconds(stamps) / 3600, 2)
    result = {"arquivos": len(files), "primeira_resposta": first, "ultima_resposta": last, "linhas": out, "usd_total": str(grand),
              "atividade_estimada_h": hours}
    if "--json" in sys.argv:
        print(json.dumps(result, indent=1, ensure_ascii=False))
        return
    print(f"{len(files)} arquivos; respostas de {first} a {last}")
    hdr = ["grupo", "modelo", "velocidade", "respostas", "input", "output", "cache_read", "cache_write_5m", "cache_write_1h", "cache_write_sem_ttl", "usd_equivalente_api"]
    print("| " + " | ".join(hdr) + " |\n|" + "---|" * len(hdr))
    for o in out:
        print("| " + " | ".join(f"{o[h]:,}".replace(",", ".") if isinstance(o[h], int) else str(o[h]) for h in hdr) + " |")
    print(f"Total equivalente em preço de API: US$ {grand}")
    print(f"Atividade estimada da sessão (intervalos até 5 min, sem sobreposição): {hours} h")


if __name__ == "__main__":
    main()

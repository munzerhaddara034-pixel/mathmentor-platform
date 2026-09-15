#!/usr/bin/env python3
"""Seed remaining Grade 12 LS / SE / GS topic banks and refresh LS contestTopics."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from g12_bank_common import BANKS, LS_TOPICS, dump_bank
from g12_ls_items import ls_mcq_bank, ls_prob_bank, ls_space_bank
from g12_se_items import se_fn_bank, se_mcq_bank, se_prob_bank
from g12_gs_items import gs_cx_bank, gs_fn_bank, gs_mcq_bank, gs_prob_bank, gs_space_bank


def patch_ls_functions_contest_topics() -> None:
    path = BANKS / "g12-ls" / "functions.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["contestTopics"] = LS_TOPICS
    data["nextTopicFiles"] = ["content/banks/g12-ls/integration.json"]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  patched contestTopics on {path.relative_to(BANKS.parent.parent)}")


def validate(payload: dict) -> None:
    qs = payload["questions"]
    seen = set()
    bands = {"easy": 0, "medium": 0, "hard": 0}
    order = []
    for q in qs:
        if q["id"] in seen:
            raise SystemExit(f"duplicate id {q['id']}")
        seen.add(q["id"])
        if q["source"]["kind"] != "generated-in-official-style":
            raise SystemExit(f"{q['id']}: bad source.kind")
        if len(q["choices"]) != 4:
            raise SystemExit(f"{q['id']}: need 4 choices")
        if q["answer"] != q["choices"][q["answerIndex"]]:
            raise SystemExit(f"{q['id']}: answer mismatch")
        if q["slice"] not in {s["id"] for s in payload["slices"]}:
            raise SystemExit(f"{q['id']}: unknown slice {q['slice']}")
        bands[q["difficulty"]] += 1
        order.append(q["difficulty"])
    if len(qs) < 30:
        raise SystemExit(f"{payload['id']}: {len(qs)} < 30")
    if min(bands.values()) < 6:
        raise SystemExit(f"{payload['id']}: thin difficulty split {bands}")
    rank = {"easy": 0, "medium": 1, "hard": 2}
    if order != sorted(order, key=lambda d: rank[d]):
        raise SystemExit(f"{payload['id']}: not sorted easy→hard")


def main() -> None:
    banks = [
        (BANKS / "g12-ls" / "space-geometry.json", ls_space_bank),
        (BANKS / "g12-ls" / "probability.json", ls_prob_bank),
        (BANKS / "g12-ls" / "mcq-mixed.json", ls_mcq_bank),
        (BANKS / "g12-se" / "functions.json", se_fn_bank),
        (BANKS / "g12-se" / "probability.json", se_prob_bank),
        (BANKS / "g12-se" / "mcq-mixed.json", se_mcq_bank),
        (BANKS / "g12-gs" / "functions.json", gs_fn_bank),
        (BANKS / "g12-gs" / "space-geometry.json", gs_space_bank),
        (BANKS / "g12-gs" / "probability.json", gs_prob_bank),
        (BANKS / "g12-gs" / "complex.json", gs_cx_bank),
        (BANKS / "g12-gs" / "mcq-mixed.json", gs_mcq_bank),
    ]
    print("Building G12 banks…")
    for mod in ("g12_ls_items", "g12_se_items", "g12_gs_items"):
        errors = getattr(__import__(mod), "ERRORS", [])
        if errors:
            print(f"ITEM ERRORS in {mod}:")
            for row in errors:
                print(" ", row)
            raise SystemExit(1)
    for path, factory in banks:
        payload = factory()
        validate(payload)
        dump_bank(path, payload)
    patch_ls_functions_contest_topics()
    print("done.")


if __name__ == "__main__":
    main()

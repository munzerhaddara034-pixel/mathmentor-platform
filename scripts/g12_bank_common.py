#!/usr/bin/env python3
"""Shared helpers for Grade 12 LS / SE / GS topic banks."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANKS = ROOT / "content/banks"

BAND = {"easy": 0, "medium": 1, "hard": 2}

LS_MODELS = ["LS all sessions.pdf"]
SE_MODELS = ["SE_All Sessions.pdf"]
GS_MODELS = ["GS-All.pdf"]

LS_TOPICS = [
    {
        "id": "mcq-mixed",
        "file": "content/banks/g12-ls/mcq-mixed.json",
        "title": "I · Mixed MCQ",
        "arabicTitle": "أولاً · أسئلة مختلطة",
        "implemented": True,
    },
    {
        "id": "space-geometry",
        "file": "content/banks/g12-ls/space-geometry.json",
        "title": "II · Space geometry",
        "arabicTitle": "ثانياً · هندسة الفضاء",
        "implemented": True,
    },
    {
        "id": "probability",
        "file": "content/banks/g12-ls/probability.json",
        "title": "III · Probability",
        "arabicTitle": "ثالثاً · الاحتمالات",
        "implemented": True,
    },
    {
        "id": "functions",
        "file": "content/banks/g12-ls/functions.json",
        "title": "IV · Functions analysis",
        "arabicTitle": "رابعاً · دراسة الدوال",
        "implemented": True,
    },
]

SE_TOPICS = [
    {
        "id": "mcq-mixed",
        "file": "content/banks/g12-se/mcq-mixed.json",
        "title": "I · Mixed MCQ",
        "arabicTitle": "أولاً · أسئلة مختلطة",
        "implemented": True,
    },
    {
        "id": "probability",
        "file": "content/banks/g12-se/probability.json",
        "title": "II · Probability & statistics",
        "arabicTitle": "ثانياً · الاحتمالات والإحصاء",
        "implemented": True,
    },
    {
        "id": "functions",
        "file": "content/banks/g12-se/functions.json",
        "title": "III · Functions & economic analysis",
        "arabicTitle": "ثالثاً · الدوال والتحليل الاقتصادي",
        "implemented": True,
    },
]

GS_TOPICS = [
    {
        "id": "mcq-mixed",
        "file": "content/banks/g12-gs/mcq-mixed.json",
        "title": "I · Mixed MCQ",
        "arabicTitle": "أولاً · أسئلة مختلطة",
        "implemented": True,
    },
    {
        "id": "space-geometry",
        "file": "content/banks/g12-gs/space-geometry.json",
        "title": "II · Space geometry",
        "arabicTitle": "ثانياً · هندسة الفضاء",
        "implemented": True,
    },
    {
        "id": "probability",
        "file": "content/banks/g12-gs/probability.json",
        "title": "III · Probability",
        "arabicTitle": "ثالثاً · الاحتمالات",
        "implemented": True,
    },
    {
        "id": "complex",
        "file": "content/banks/g12-gs/complex.json",
        "title": "IV · Complex numbers",
        "arabicTitle": "رابعاً · الأعداد المركبة",
        "implemented": True,
    },
    {
        "id": "functions",
        "file": "content/banks/g12-gs/functions.json",
        "title": "V · Functions analysis",
        "arabicTitle": "خامساً · دراسة الدوال",
        "implemented": True,
    },
]


def source(models: list[str], tag: str, extra: str = "") -> dict:
    note = (
        "Academy-original. Patterned on Lebanese Grade 12 official-session wording. "
        "Not a photocopy of any past paper."
    )
    if extra:
        note = extra + " " + note
    return {
        "kind": "generated-in-official-style",
        "models": models,
        "note": note,
        "tag": tag,
    }


def item(
    qid: str,
    slice_id: str,
    difficulty: str,
    stem: str,
    choices: list[str],
    answer_index: int,
    sketch: list[str],
    models: list[str],
    latex: str | None = None,
    tag: str = "",
) -> dict:
    if not isinstance(answer_index, int) or not isinstance(choices, list):
        raise ValueError(
            f"{qid}: bad Q() args (choices type={type(choices).__name__}, "
            f"answer_index type={type(answer_index).__name__})"
        )
    if len(choices) != 4:
        raise ValueError(f"{qid}: expected 4 choices, got {len(choices)}: {choices!r}")
    if not 0 <= answer_index < len(choices):
        raise ValueError(f"{qid}: answerIndex {answer_index} out of range")
    row = {
        "id": qid,
        "slice": slice_id,
        "difficulty": difficulty,
        "source": source(models, tag or slice_id),
        "stem": stem,
        "choices": choices,
        "answerIndex": answer_index,
        "answer": choices[answer_index],
        "solutionSketch": sketch,
    }
    if latex:
        row["latex"] = latex
    return row


def sort_items(items: list[dict], rank: dict[str, int]) -> list[dict]:
    items = list(items)
    items.sort(key=lambda q: (BAND[q["difficulty"]], rank.get(q["slice"], 9), q["id"]))
    return items


def dump_bank(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    qs = payload["questions"]
    bands = {b: sum(1 for q in qs if q["difficulty"] == b) for b in ("easy", "medium", "hard")}
    print(f"  {path.relative_to(ROOT)}  ({len(qs)} items: {bands})")


def make_bank(
    *,
    bank_id: str,
    track: str,
    certificate: str,
    topic: str,
    title: str,
    arabic_title: str,
    models: list[str],
    style_note: str,
    slices: list[dict],
    questions: list[dict],
    contest_topics: list[dict],
    contest_minutes: int = 25,
    pass_score: int = 70,
    lesson_id: str | None = None,
    next_topic_files: list[str] | None = None,
    order: str | None = None,
) -> dict:
    questions = [q for q in questions if q]
    rank = {s["id"]: i for i, s in enumerate(slices)}
    qs = sort_items(questions, rank)
    ids = [q["id"] for q in qs]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{bank_id}: duplicate question ids")
    if len(qs) < 30:
        raise ValueError(f"{bank_id}: need ≥30 items, got {len(qs)}")
    payload = {
        "id": bank_id,
        "track": track,
        "certificate": certificate,
        "topic": topic,
        "title": title,
        "arabicTitle": arabic_title,
        "contestMinutes": contest_minutes,
        "passScore": pass_score,
        "sourceModels": models,
        "styleNote": style_note,
        "slices": slices,
        "order": order
        or "easy → medium → hard (within a band: pedagogical slice order)",
        "contestTopics": contest_topics,
        "questions": qs,
    }
    if lesson_id:
        payload["lessonId"] = lesson_id
    if next_topic_files is not None:
        payload["nextTopicFiles"] = next_topic_files
    return payload

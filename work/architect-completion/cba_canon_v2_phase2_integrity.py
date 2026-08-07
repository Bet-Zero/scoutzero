#!/usr/bin/env python3
"""Mechanical integrity checks for the Phase 2 implementation-gap register."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path


EXPECTED_FAMILY_COUNTS = {"A": 151, "C": 417, "R": 118, "L": 102, "S": 27}
EXPECTED_SCHEMA_VERSION = "2.0"
LEAF_RE = re.compile(r"CBA2-([ACRLS])\d{2}\.\d+")
NEGATIVE_SEARCH_LEAF_RE = re.compile(r"^(CBA2-[ACRLS]\d{2}\.\d+)\b")
EVIDENCE_PATH_RE = re.compile(r"^(?:src|tests)/.+\.(?:tsx?|jsx?)(?::.+)?$")
IMPLEMENTATION_STATES = {"correct", "incorrect", "partial", "absent", "not applicable"}
CANON_COVERAGE = {
    "covered and proven",
    "partial",
    "missing in scope",
    "intentional exclusion",
    "data-blocked",
    "externally adjudicated",
}
LAYER_STATES = {"covered", "partial", "absent", "not applicable", "insufficient evidence"}
RUNTIME_INPUT_STATES = {"available", "partial", "missing", "external determination", "not required"}
EVIDENCE_STRENGTH = {"proven", "insufficient"}
SEVERITIES = {"Critical", "High", "Medium", "Low", "None"}
PASSES = {"deterministic correctness", "cap manager completeness", "full gm depth"}
LAYERS = {
    "representation_data_model",
    "calculation",
    "enforcement",
    "explanation_ui_presentation",
    "lifecycle_persistence",
}
EVIDENCE_FIELDS = {"implementation", "tests", "negative_search", "inspection_notes"}
REQUIRED_RECORD_FIELDS = {
    "leaf_id",
    "family",
    "group_id",
    "pass",
    "canon_rule",
    "canon_authority",
    "canon_verification_method",
    "canon_lifecycle_date_inputs",
    "canon_coverage_classification",
    "implementation_state",
    "product_layers",
    "runtime_input_state",
    "evidence_strength",
    "severity",
    "evidence",
    "smallest_likely_remediation",
    "shared_root_cause_cluster",
}


def pipe_cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip()[1:-1].split("|")]


def section(text: str, start: str, end: str) -> str:
    start_at = text.index(start)
    end_at = text.index(end, start_at + len(start))
    return text[start_at:end_at]


def canon_leaves(canon_path: Path) -> dict[str, dict[str, str]]:
    text = canon_path.read_text(encoding="utf-8")
    main = section(
        text,
        "#### 15.10.2 A family — active LEAF register (main table)",
        "#### 15.10.3 A family — active LEAF register (detail table)",
    )
    detail = section(
        text,
        "#### 15.10.3 A family — active LEAF register (detail table)",
        "### 15.11 Historical crosswalk (created by R3; A family)",
    )

    main_header: list[str] | None = None
    detail_header: list[str] | None = None
    main_rows: dict[str, dict[str, str]] = {}
    detail_rows: dict[str, dict[str, str]] = {}
    for line in main.splitlines():
        if not line.startswith("|"):
            continue
        cells = pipe_cells(line)
        if cells and cells[0] == "ID":
            main_header = cells
        elif main_header and cells and LEAF_RE.fullmatch(cells[0].strip("`")):
            leaf_id = cells[0].strip("`")
            main_rows[leaf_id] = dict(zip(main_header, cells, strict=True))
    for line in detail.splitlines():
        if not line.startswith("|"):
            continue
        cells = pipe_cells(line)
        if cells and cells[0] == "ID":
            detail_header = cells
        elif detail_header and cells and LEAF_RE.fullmatch(cells[0].strip("`")):
            leaf_id = cells[0].strip("`")
            detail_rows[leaf_id] = dict(zip(detail_header, cells, strict=True))

    if set(main_rows) != set(detail_rows):
        raise ValueError("Canon LEAF main/detail identity sets do not match")
    return {
        leaf_id: {"main": main_rows[leaf_id], "detail": detail_rows[leaf_id]}
        for leaf_id in main_rows
    }


def validate_canon(leaves: dict[str, dict[str, str]]) -> list[str]:
    errors: list[str] = []
    counts = Counter(match.group(1) for leaf_id in leaves if (match := LEAF_RE.fullmatch(leaf_id)))
    if len(leaves) != 815:
        errors.append(f"Canon active LEAF count is {len(leaves)}, expected 815")
    if dict(counts) != EXPECTED_FAMILY_COUNTS:
        errors.append(f"Canon family counts are {dict(counts)}, expected {EXPECTED_FAMILY_COUNTS}")
    return errors


def validate_register(path: Path, leaves: dict[str, dict[str, str]]) -> list[str]:
    errors: list[str] = []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema_version") != EXPECTED_SCHEMA_VERSION:
        errors.append(
            f"register.schema_version is {payload.get('schema_version')!r}, "
            f"expected {EXPECTED_SCHEMA_VERSION!r}"
        )
    records = payload.get("records")
    if not isinstance(records, list):
        return ["register.records must be an array"]
    if payload.get("record_count") != len(records):
        errors.append("register.record_count must equal the records array length")
    ids = [record.get("leaf_id") for record in records if isinstance(record, dict)]
    duplicates = sorted(key for key, count in Counter(ids).items() if count > 1)
    if duplicates:
        errors.append(f"duplicate register identities: {duplicates}")
    if set(ids) != set(leaves):
        errors.append(
            "register identity set differs from Canon: "
            f"missing={sorted(set(leaves) - set(ids))}, extra={sorted(set(ids) - set(leaves))}"
        )
    if len(records) != 815:
        errors.append(f"register record count is {len(records)}, expected 815")

    for index, record in enumerate(records):
        label = record.get("leaf_id", f"record[{index}]") if isinstance(record, dict) else f"record[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{label}: record must be an object")
            continue
        missing_fields = sorted(REQUIRED_RECORD_FIELDS - set(record))
        if missing_fields:
            errors.append(f"{label}: missing fields {missing_fields}")
            continue
        match = LEAF_RE.fullmatch(record["leaf_id"])
        if not match or record["family"] != match.group(1):
            errors.append(f"{label}: family does not match LEAF identity")
        if record["group_id"] != record["leaf_id"].split(".")[0]:
            errors.append(f"{label}: group_id does not match LEAF identity")
        allowed_values = (
            ("pass", PASSES),
            ("canon_coverage_classification", CANON_COVERAGE),
            ("implementation_state", IMPLEMENTATION_STATES),
            ("runtime_input_state", RUNTIME_INPUT_STATES),
            ("evidence_strength", EVIDENCE_STRENGTH),
            ("severity", SEVERITIES),
        )
        for field, allowed in allowed_values:
            if record[field] not in allowed:
                errors.append(f"{label}: invalid {field}={record[field]!r}")
        layers = record["product_layers"]
        if not isinstance(layers, dict) or set(layers) != LAYERS:
            errors.append(f"{label}: product_layers must contain exactly {sorted(LAYERS)}")
        elif any(value not in LAYER_STATES for value in layers.values()):
            errors.append(f"{label}: product_layers contains an invalid state")
        evidence = record["evidence"]
        if not isinstance(evidence, dict) or set(evidence) != EVIDENCE_FIELDS:
            errors.append(f"{label}: evidence must contain exactly {sorted(EVIDENCE_FIELDS)}")
        else:
            for key in EVIDENCE_FIELDS:
                values = evidence[key]
                if not isinstance(values, list):
                    errors.append(f"{label}: evidence.{key} must be an array")
                elif any(not isinstance(value, str) or not value.strip() for value in values):
                    errors.append(f"{label}: evidence.{key} must contain only non-empty text")
            if all(isinstance(evidence[key], list) for key in EVIDENCE_FIELDS):
                if not evidence["inspection_notes"]:
                    errors.append(f"{label}: evidence.inspection_notes must be non-empty")
                path_values = evidence["implementation"] + evidence["tests"]
                if any(not EVIDENCE_PATH_RE.fullmatch(value) for value in path_values):
                    errors.append(f"{label}: implementation/tests evidence must contain paths only")
                if any(EVIDENCE_PATH_RE.fullmatch(value) for value in evidence["negative_search"]):
                    errors.append(f"{label}: evidence.negative_search must contain prose only")
                for value in evidence["negative_search"]:
                    prefix = NEGATIVE_SEARCH_LEAF_RE.match(value)
                    if prefix and prefix.group(1) != record["leaf_id"]:
                        errors.append(
                            f"{label}: evidence.negative_search leaf prefix "
                            f"{prefix.group(1)} does not match host leaf_id"
                        )
                if not (
                    evidence["implementation"]
                    or evidence["tests"]
                    or evidence["negative_search"]
                ):
                    errors.append(f"{label}: evidence must include a path or negative search")
        for field in ("canon_rule", "canon_authority", "canon_verification_method", "canon_lifecycle_date_inputs", "smallest_likely_remediation", "shared_root_cause_cluster"):
            if not isinstance(record[field], str) or not record[field].strip():
                errors.append(f"{label}: {field} must be non-empty text")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canon", type=Path, default=Path("docs/reference/cba/ARCHITECT_CBA_CANON.md"))
    parser.add_argument("--register", type=Path, default=Path("work/architect-completion/ARCHITECT_CBA_CANON_V2_PHASE2_IMPLEMENTATION_GAPS.json"))
    parser.add_argument("--canon-only", action="store_true")
    args = parser.parse_args()
    try:
        leaves = canon_leaves(args.canon)
        errors = validate_canon(leaves)
        if not args.canon_only:
            errors.extend(validate_register(args.register, leaves))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors = [str(exc)]
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    counts = Counter(leaf_id[5] for leaf_id in leaves)
    mode = "Canon" if args.canon_only else "Canon/register"
    print(f"PASS: {mode} integrity — 815 unique LEAFs; " + ", ".join(f"{key} {counts[key]}" for key in "ACRLS"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def add_edf_files(archive: ZipFile, source: Path, group: str) -> int:
    count = 0
    for path in sorted(source.glob("*.edf")):
        archive.write(path, f"edf/{group}/{path.name}")
        count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a private EEG dataset zip for server upload.")
    parser.add_argument("--epilepsy", required=True, type=Path)
    parser.add_argument("--no-epilepsy", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.out, "w", compression=ZIP_DEFLATED) as archive:
        epilepsy_count = add_edf_files(archive, args.epilepsy.expanduser(), "epilepsy")
        no_epilepsy_count = add_edf_files(archive, args.no_epilepsy.expanduser(), "no_epilepsy")
    print(f"Wrote {args.out}")
    print(f"epilepsy={epilepsy_count} no_epilepsy={no_epilepsy_count}")


if __name__ == "__main__":
    main()

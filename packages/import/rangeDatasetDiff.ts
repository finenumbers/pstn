export type RangeRecord = {
  abc: string;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  operator: string;
  region: string;
  garTerritory: string;
  inn: string;
};

export type RangeChangeType = "added" | "changed" | "removed";

export type DiffSegment = RangeRecord & {
  changeType: RangeChangeType;
  prevRangeStart?: number;
  prevRangeEnd?: number;
  prevCapacity?: number;
  prevOperator?: string;
  prevRegion?: string;
  prevGarTerritory?: string;
  prevInn?: string;
};

function rangesEqual(a: RangeRecord, b: RangeRecord): boolean {
  return (
    a.rangeStart === b.rangeStart &&
    a.rangeEnd === b.rangeEnd &&
    a.capacity === b.capacity &&
    a.operator === b.operator &&
    a.region === b.region &&
    a.garTerritory === b.garTerritory &&
    a.inn === b.inn
  );
}

function findCoveringRange(
  ranges: RangeRecord[],
  segmentStart: number,
  segmentEnd: number
): RangeRecord | null {
  for (const range of ranges) {
    if (range.rangeStart <= segmentStart && range.rangeEnd >= segmentEnd) {
      return range;
    }
  }
  return null;
}

function segmentCapacity(start: number, end: number): number {
  return end >= start ? end - start + 1 : 0;
}

function displayRecordFromNew(
  newCover: RangeRecord,
  segmentStart: number,
  segmentEnd: number
): RangeRecord {
  return {
    abc: newCover.abc,
    rangeStart: segmentStart,
    rangeEnd: segmentEnd,
    capacity: segmentCapacity(segmentStart, segmentEnd),
    operator: newCover.operator,
    region: newCover.region,
    garTerritory: newCover.garTerritory,
    inn: newCover.inn,
  };
}

function displayRecordFromOld(
  oldCover: RangeRecord,
  segmentStart: number,
  segmentEnd: number
): RangeRecord {
  return {
    abc: oldCover.abc,
    rangeStart: segmentStart,
    rangeEnd: segmentEnd,
    capacity: segmentCapacity(segmentStart, segmentEnd),
    operator: oldCover.operator,
    region: oldCover.region,
    garTerritory: oldCover.garTerritory,
    inn: oldCover.inn,
  };
}

function collectBoundaries(
  oldRanges: RangeRecord[],
  newRanges: RangeRecord[]
): number[] {
  const points = new Set<number>();
  for (const range of oldRanges) {
    points.add(range.rangeStart);
    points.add(range.rangeEnd + 1);
  }
  for (const range of newRanges) {
    points.add(range.rangeStart);
    points.add(range.rangeEnd + 1);
  }
  return Array.from(points).sort((a, b) => a - b);
}

/** Avoid `target.push(...source)` — spread blows the call stack on large arrays. */
function appendAll<T>(target: T[], source: readonly T[]): void {
  for (let index = 0; index < source.length; index++) {
    target.push(source[index]!);
  }
}

function mergeAdjacentSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];

  const merged: DiffSegment[] = [];
  let current = segments[0]!;

  for (let index = 1; index < segments.length; index++) {
    const next = segments[index]!;
    const canMerge =
      current.changeType === next.changeType &&
      current.rangeEnd + 1 === next.rangeStart &&
      current.operator === next.operator &&
      current.region === next.region &&
      current.garTerritory === next.garTerritory &&
      current.inn === next.inn &&
      current.prevOperator === next.prevOperator &&
      current.prevRegion === next.prevRegion &&
      current.prevGarTerritory === next.prevGarTerritory &&
      current.prevInn === next.prevInn;

    if (canMerge) {
      current = {
        ...current,
        rangeEnd: next.rangeEnd,
        capacity: segmentCapacity(current.rangeStart, next.rangeEnd),
        prevRangeEnd: next.prevRangeEnd ?? current.prevRangeEnd,
      };
      continue;
    }

    merged.push(current);
    current = next;
  }

  merged.push(current);
  return merged;
}

export function diffRangesForAbc(
  abc: string,
  oldRanges: RangeRecord[],
  newRanges: RangeRecord[]
): DiffSegment[] {
  const boundaries = collectBoundaries(oldRanges, newRanges);
  if (boundaries.length < 2) return [];

  const segments: DiffSegment[] = [];

  for (let index = 0; index < boundaries.length - 1; index++) {
    const segmentStart = boundaries[index]!;
    const segmentEnd = boundaries[index + 1]! - 1;
    if (segmentStart > segmentEnd) continue;

    const oldCover = findCoveringRange(oldRanges, segmentStart, segmentEnd);
    const newCover = findCoveringRange(newRanges, segmentStart, segmentEnd);

    if (!oldCover && newCover) {
      segments.push({
        ...displayRecordFromNew(newCover, segmentStart, segmentEnd),
        changeType: "added",
      });
      continue;
    }

    if (oldCover && !newCover) {
      segments.push({
        ...displayRecordFromOld(oldCover, segmentStart, segmentEnd),
        changeType: "removed",
        prevRangeStart: oldCover.rangeStart,
        prevRangeEnd: oldCover.rangeEnd,
        prevCapacity: oldCover.capacity,
        prevOperator: oldCover.operator,
        prevRegion: oldCover.region,
        prevGarTerritory: oldCover.garTerritory,
        prevInn: oldCover.inn,
      });
      continue;
    }

    if (oldCover && newCover) {
      const oldDisplay = displayRecordFromOld(oldCover, segmentStart, segmentEnd);
      const newDisplay = displayRecordFromNew(newCover, segmentStart, segmentEnd);
      const boundariesDiffer =
        oldCover.rangeStart !== newCover.rangeStart ||
        oldCover.rangeEnd !== newCover.rangeEnd;
      if (rangesEqual(oldDisplay, newDisplay) && !boundariesDiffer) {
        continue;
      }

      segments.push({
        ...newDisplay,
        abc,
        changeType: "changed",
        prevRangeStart: oldDisplay.rangeStart,
        prevRangeEnd: oldDisplay.rangeEnd,
        prevCapacity: oldDisplay.capacity,
        prevOperator: oldDisplay.operator,
        prevRegion: oldDisplay.region,
        prevGarTerritory: oldDisplay.garTerritory,
        prevInn: oldDisplay.inn,
      });
    }
  }

  return mergeAdjacentSegments(segments);
}

export function diffRangeDatasets(
  oldRanges: RangeRecord[],
  newRanges: RangeRecord[]
): DiffSegment[] {
  const abcCodes = new Set<string>();
  for (const range of oldRanges) abcCodes.add(range.abc);
  for (const range of newRanges) abcCodes.add(range.abc);

  const oldByAbc = new Map<string, RangeRecord[]>();
  const newByAbc = new Map<string, RangeRecord[]>();

  for (const range of oldRanges) {
    const list = oldByAbc.get(range.abc) ?? [];
    list.push(range);
    oldByAbc.set(range.abc, list);
  }

  for (const range of newRanges) {
    const list = newByAbc.get(range.abc) ?? [];
    list.push(range);
    newByAbc.set(range.abc, list);
  }

  const result: DiffSegment[] = [];
  for (const abc of Array.from(abcCodes).sort()) {
    appendAll(
      result,
      diffRangesForAbc(
        abc,
        oldByAbc.get(abc) ?? [],
        newByAbc.get(abc) ?? []
      )
    );
  }

  return result;
}

export function countDiffSegments(segments: DiffSegment[]): {
  added: number;
  changed: number;
  removed: number;
} {
  let added = 0;
  let changed = 0;
  let removed = 0;
  for (const segment of segments) {
    if (segment.changeType === "added") added++;
    else if (segment.changeType === "changed") changed++;
    else removed++;
  }
  return { added, changed, removed };
}

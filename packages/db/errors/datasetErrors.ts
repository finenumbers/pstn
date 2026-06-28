export class DatasetNotFoundError extends Error {
  readonly snapshotId: string;

  constructor(snapshotId: string) {
    super(`Dataset snapshot not found: ${snapshotId}`);
    this.name = "DatasetNotFoundError";
    this.snapshotId = snapshotId;
  }
}

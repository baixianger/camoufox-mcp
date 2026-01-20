import { describe, it, expect, beforeEach } from 'vitest';

// Simulate the snapshot version logic for testing
let snapshotVersion = 0;

function getCurrentSnapshotVersion(): number {
  return snapshotVersion;
}

function incrementSnapshotVersion(): number {
  return ++snapshotVersion;
}

function resetSnapshotVersion(): void {
  snapshotVersion = 0;
}

// Validate that UID is from current snapshot version
function validateUid(uid: string): void {
  const parts = uid.split('_');
  if (parts.length !== 2) {
    throw new Error(`Invalid UID format: ${uid}. Expected format: version_index (e.g., "1_0").`);
  }

  const uidVersion = parseInt(parts[0], 10);
  const currentVersion = getCurrentSnapshotVersion();

  if (isNaN(uidVersion)) {
    throw new Error(`Invalid UID format: ${uid}. Version must be a number.`);
  }

  if (currentVersion === 0) {
    throw new Error('No snapshot taken yet. Call takeSnapshot first.');
  }

  if (uidVersion !== currentVersion) {
    throw new Error(
      `This UID (${uid}) is from a stale snapshot (version ${uidVersion}). ` +
      `Current snapshot version is ${currentVersion}. Take a new snapshot first.`
    );
  }
}

describe('Snapshot Version System', () => {
  beforeEach(() => {
    resetSnapshotVersion();
  });

  describe('Version Counter', () => {
    it('should start at 0', () => {
      expect(getCurrentSnapshotVersion()).toBe(0);
    });

    it('should increment correctly', () => {
      expect(incrementSnapshotVersion()).toBe(1);
      expect(incrementSnapshotVersion()).toBe(2);
      expect(incrementSnapshotVersion()).toBe(3);
    });

    it('should reset correctly', () => {
      incrementSnapshotVersion();
      incrementSnapshotVersion();
      resetSnapshotVersion();
      expect(getCurrentSnapshotVersion()).toBe(0);
    });
  });

  describe('UID Validation', () => {
    it('should throw if no snapshot taken yet', () => {
      expect(() => validateUid('1_0')).toThrow('No snapshot taken yet');
    });

    it('should accept valid UID from current snapshot', () => {
      incrementSnapshotVersion(); // version = 1
      expect(() => validateUid('1_0')).not.toThrow();
      expect(() => validateUid('1_5')).not.toThrow();
      expect(() => validateUid('1_99')).not.toThrow();
    });

    it('should reject stale UID from old snapshot', () => {
      incrementSnapshotVersion(); // version = 1
      incrementSnapshotVersion(); // version = 2

      expect(() => validateUid('1_0')).toThrow('stale snapshot (version 1)');
      expect(() => validateUid('1_5')).toThrow('stale snapshot');
    });

    it('should reject UID from future snapshot', () => {
      incrementSnapshotVersion(); // version = 1

      expect(() => validateUid('5_0')).toThrow('stale snapshot (version 5)');
    });

    it('should reject invalid UID format - no underscore', () => {
      incrementSnapshotVersion();
      expect(() => validateUid('ref0')).toThrow('Invalid UID format');
    });

    it('should reject invalid UID format - old ref_ format', () => {
      incrementSnapshotVersion();
      expect(() => validateUid('ref_0')).toThrow('Version must be a number');
    });

    it('should reject invalid UID format - multiple underscores', () => {
      incrementSnapshotVersion();
      expect(() => validateUid('1_2_3')).toThrow('Invalid UID format');
    });

    it('should reject non-numeric version', () => {
      incrementSnapshotVersion();
      expect(() => validateUid('abc_0')).toThrow('Version must be a number');
    });
  });

  describe('UID Format', () => {
    it('should generate correct UID format', () => {
      const version = incrementSnapshotVersion();
      const uid = `${version}_0`;
      expect(uid).toBe('1_0');
    });

    it('should generate unique UIDs per snapshot', () => {
      const v1 = incrementSnapshotVersion();
      const uid1 = `${v1}_0`;

      const v2 = incrementSnapshotVersion();
      const uid2 = `${v2}_0`;

      expect(uid1).toBe('1_0');
      expect(uid2).toBe('2_0');
      expect(uid1).not.toBe(uid2);
    });
  });
});

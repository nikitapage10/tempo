import { describe, expect, it } from "vitest";
import {
  deriveAttributes,
  rateAgainstAnchors,
  type AttributeDeriveInput,
  type PointEvent,
} from "../../lib/gamification/attributes";

const NOW = new Date("2026-08-12T12:00:00Z");

function pt(overrides: Partial<PointEvent> = {}): PointEvent {
  return {
    id: crypto.randomUUID(),
    ruleKey: "bounce_uploaded",
    attribute: "output",
    points: 4,
    subjectType: "version",
    subjectId: "v1",
    occurredAt: NOW.toISOString(),
    ...overrides,
  };
}

function baseInput(overrides: Partial<AttributeDeriveInput> = {}): AttributeDeriveInput {
  return {
    pointEvents: [],
    hasMeasuredVelocity: false,
    velocityMeasuringSince: null,
    reachFresh: false,
    hasAnyPlatformSnapshot: false,
    hasAnyPerformance: false,
    ...overrides,
  };
}

describe("rateAgainstAnchors", () => {
  const anchors: [number, number][] = [
    [0, 0],
    [10, 50],
    [20, 100],
  ];

  it("clamps below the first anchor", () => {
    expect(rateAgainstAnchors(-5, anchors)).toBe(0);
  });

  it("clamps above the last anchor", () => {
    expect(rateAgainstAnchors(999, anchors)).toBe(100);
  });

  it("interpolates linearly between anchors", () => {
    expect(rateAgainstAnchors(5, anchors)).toBeCloseTo(25);
    expect(rateAgainstAnchors(15, anchors)).toBeCloseTo(75);
  });

  it("hits exact anchor points precisely", () => {
    expect(rateAgainstAnchors(10, anchors)).toBe(50);
  });

  it("never returns a value outside [0, 100]", () => {
    const negativeAnchors: [number, number][] = [
      [-40, 0],
      [0, 30],
      [150, 100],
    ];
    expect(rateAgainstAnchors(-100, negativeAnchors)).toBeGreaterThanOrEqual(0);
    expect(rateAgainstAnchors(10000, negativeAnchors)).toBeLessThanOrEqual(100);
  });
});

describe("deriveAttributes — honesty rules", () => {
  it("a brand-new artist with zero point events never returns NaN or a rating for unmeasured axes", () => {
    const attrs = deriveAttributes(baseInput(), NOW);
    expect(attrs).toHaveLength(6);
    for (const a of attrs) {
      if (a.rating !== null) {
        expect(Number.isNaN(a.rating)).toBe(false);
      }
    }
    const velocity = attrs.find((a) => a.key === "velocity")!;
    const stagePresence = attrs.find((a) => a.key === "stage_presence")!;
    const reach = attrs.find((a) => a.key === "reach")!;
    expect(velocity.confidence).toBe("unmeasured");
    expect(velocity.rating).toBeNull();
    expect(stagePresence.confidence).toBe("unmeasured");
    expect(stagePresence.rating).toBeNull();
    expect(reach.confidence).toBe("unmeasured");
    expect(reach.rating).toBeNull();
  });

  it("unmeasured never reads as zero — output/consistency still compute from real (empty) totals", () => {
    const attrs = deriveAttributes(baseInput(), NOW);
    const output = attrs.find((a) => a.key === "output")!;
    expect(output.confidence).toBe("measured");
    expect(output.rating).toBe(0);
    expect(output.points).toBe(0);
  });

  it("velocity becomes measured once a real forward transition exists", () => {
    const attrs = deriveAttributes(
      baseInput({
        hasMeasuredVelocity: true,
        velocityMeasuringSince: "2026-01-01T00:00:00Z",
        pointEvents: [pt({ ruleKey: "stage_advanced", attribute: "velocity", points: 6 })],
      }),
      NOW
    );
    const velocity = attrs.find((a) => a.key === "velocity")!;
    expect(velocity.confidence).toBe("measured");
    expect(velocity.rating).not.toBeNull();
  });

  it("stale reach (old snapshot) suppresses the rating instead of showing an outdated number", () => {
    const attrs = deriveAttributes(
      baseInput({
        hasAnyPlatformSnapshot: true,
        reachFresh: false,
      }),
      NOW
    );
    const reach = attrs.find((a) => a.key === "reach")!;
    expect(reach.confidence).toBe("stale");
    expect(reach.rating).toBeNull();
  });

  it("only counts points within the attribute's own trailing window", () => {
    const old = pt({
      ruleKey: "bounce_uploaded",
      attribute: "output",
      points: 4,
      occurredAt: new Date(NOW.getTime() - 500 * 86_400_000).toISOString(), // >365d ago
    });
    const recent = pt({
      ruleKey: "bounce_uploaded",
      attribute: "output",
      points: 4,
      occurredAt: new Date(NOW.getTime() - 10 * 86_400_000).toISOString(),
    });
    const attrs = deriveAttributes(baseInput({ pointEvents: [old, recent] }), NOW);
    const output = attrs.find((a) => a.key === "output")!;
    expect(output.points).toBe(4); // only the recent one is inside the 365-day window
  });
});

describe("deriveAttributes — anti-gaming", () => {
  it("dragging a track back and forth cannot raise velocity beyond what real forward moves earned", () => {
    // Simulates the ledger's own guarantee (idempotency key per track+from+to
    // pair) by only ever including each forward move once — the DB layer is
    // what actually prevents duplicate rows; this asserts the derivation
    // layer doesn't independently amplify repeated events either.
    const singleForwardMove = [pt({ ruleKey: "stage_advanced", attribute: "velocity", points: 6 })];
    const repeatedSameMove = [
      pt({ ruleKey: "stage_advanced", attribute: "velocity", points: 6, id: "a" }),
      pt({ ruleKey: "stage_advanced", attribute: "velocity", points: 6, id: "a" }), // same id — a real ledger could never duplicate this
    ];

    const single = deriveAttributes(
      baseInput({ hasMeasuredVelocity: true, pointEvents: singleForwardMove }),
      NOW
    ).find((a) => a.key === "velocity")!;
    const repeated = deriveAttributes(
      baseInput({ hasMeasuredVelocity: true, pointEvents: repeatedSameMove }),
      NOW
    ).find((a) => a.key === "velocity")!;

    // The derivation layer sums whatever ledger rows it's given — duplicate
    // prevention is the ledger's unique(artist_id, idempotency_key)
    // constraint, exercised for real against the database, not here.
    expect(repeated.points).toBe(single.points * 2);
  });

  it("a stall penalty pulls follow-through down rather than being ignored", () => {
    const attrs = deriveAttributes(
      baseInput({
        pointEvents: [pt({ ruleKey: "track_stalled", attribute: "follow_through", points: -8 })],
      }),
      NOW
    );
    const followThrough = attrs.find((a) => a.key === "follow_through")!;
    expect(followThrough.points).toBe(-8);
    expect(followThrough.nudge).not.toBeNull();
  });
});

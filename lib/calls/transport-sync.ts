export const DECK_DRIFT_THRESHOLD_SEC = 0.35;

export function expectedTransportPosition(
  positionSec: number,
  playing: boolean,
  nowMs: number,
  packetReceivedAtMs: number,
): number {
  const ageMs = Math.max(0, nowMs - packetReceivedAtMs);
  return Math.max(0, positionSec + (playing ? ageMs / 1000 : 0));
}

export function shouldCorrectTransport(localPositionSec: number, expectedPositionSec: number): boolean {
  return Math.abs(localPositionSec - expectedPositionSec) > DECK_DRIFT_THRESHOLD_SEC;
}

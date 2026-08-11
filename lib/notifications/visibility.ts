/**
 * Direct messages own their unread state in the Messages inbox. The database
 * row remains an internal realtime/Pulse signal, but it must never surface as
 * a second item or unread badge in the general Notifications center.
 */
export const DIRECT_MESSAGE_SIGNAL_TYPE = "dm_message";

export function isDirectMessageSignal(type: string | null | undefined): boolean {
  return type === DIRECT_MESSAGE_SIGNAL_TYPE;
}

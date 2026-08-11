/** Central privacy allowlist for every admin database read. */
export const PLATFORM_ADMIN_COLUMNS =
  "user_id, email, granted_at, granted_by, note";
export const USER_PROFILE_COLUMNS =
  "id, owner_user_id, handle, display_name, visibility";
export const PROFILE_PUBLIC_COLUMNS = "id, handle, display_name, visibility";
export const ACCOUNT_FLAG_COLUMNS =
  "user_id, status, reason, changed_at, changed_by";
export const INVITE_COLUMNS =
  "id, code, email, note, member_role, welcome_note, created_by, created_at, expires_at, max_uses, used_count, revoked_at, last_sent_at, send_count, email_provider_id, last_send_error";
export const INVITE_REDEMPTION_COLUMNS =
  "invite_id, user_id, redeemed_at";
export const REPORT_COLUMNS =
  "id, reporter_profile_id, target_type, target_id, reason, details, status, reviewed_by, reviewed_at, action_taken, created_at";
export const REPORT_POST_COLUMNS =
  "id, author_profile_id, body, media, visibility, created_at, deleted_at";
export const REPORT_COMMENT_COLUMNS =
  "id, post_id, author_profile_id, body, created_at, deleted_at";
export const AUDIT_COLUMNS =
  "id, admin_user_id, action, target_type, target_id, meta, created_at";
export const ID_COLUMN = "id";
export const USER_ID_COLUMN = "user_id";
export const OWNER_USER_ID_COLUMN = "owner_user_id";
export const FILE_SIZE_COLUMN = "file_size";
export const FILE_USAGE_COLUMNS = "file_size, created_at";
export const CREATED_AT_COLUMNS = "id, created_at";
export const SESSION_USAGE_COLUMNS = "id, created_at, elapsed_sec, status";
export const VERSION_OWNER_STORAGE_COLUMNS = "file_size, tracks!inner(user_id)";
export const ASSISTANT_USAGE_COLUMNS = "user_id, day, messages, escalations";
export const ACCOUNT_EVENT_COLUMNS =
  "id, actor_user_id, event_type, created_at";
export const SUPPORT_REPORT_COLUMNS =
  "id, user_id, email, category, subject, details, page_url, user_agent, source, status, admin_notes, created_at, updated_at, resolved_at, resolved_by, last_message_at, last_admin_reply_at, member_archived_at, admin_archived_at, member_last_read_at, admin_last_read_at";
export const SUPPORT_MESSAGE_COLUMNS =
  "id, report_id, sender_role, sender_user_id, body, media, reply_to_message_id, edited_at, deleted_at, deleted_by_user_id, created_at";

import type { CollaboratorRole } from "@/lib/types";

export type EffectiveRole = "owner" | CollaboratorRole | "guest" | null;

export type TrackCapabilities = {
  role: EffectiveRole;
  isOwner: boolean;
  /** Can play versions / read the workspace at all. */
  canView: boolean;
  canEditMetadata: boolean;
  canChangeWorkflow: boolean;
  canUpload: boolean;
  canDeleteVersion: boolean;
  canSetCurrentOrPin: boolean;
  canEditChecklist: boolean;
  canComment: boolean;
  canResolveAnyComment: boolean;
  canRecordDecision: boolean;
  canManageReferences: boolean;
  canManageGuestLinks: boolean;
  canManageCollaborators: boolean;
  canDeleteTrack: boolean;
  canRunFocusSession: boolean;
};

/**
 * Pure capability derivation from an effective role — SECURITY-AND-PERMISSIONS.md §3.
 * UI hiding only; RLS remains authoritative for every write.
 */
export function deriveCapabilities(role: EffectiveRole): TrackCapabilities {
  const isOwner = role === "owner";
  const isEditor = role === "editor";
  const isUploader = role === "uploader";
  const isCommenter = role === "commenter";
  const canView = role != null;

  return {
    role,
    isOwner,
    canView,
    canEditMetadata: isOwner || isEditor,
    canChangeWorkflow: isOwner || isEditor,
    canUpload: isOwner || isEditor || isUploader,
    canDeleteVersion: isOwner || isEditor,
    canSetCurrentOrPin: isOwner || isEditor,
    canEditChecklist: isOwner || isEditor,
    canComment: isOwner || isEditor || isCommenter,
    canResolveAnyComment: isOwner || isEditor,
    canRecordDecision: isOwner || isEditor,
    canManageReferences: isOwner || isEditor,
    canManageGuestLinks: isOwner,
    canManageCollaborators: isOwner,
    canDeleteTrack: isOwner,
    canRunFocusSession: isOwner || isEditor,
  };
}

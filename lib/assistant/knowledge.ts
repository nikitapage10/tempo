/**
 * Condensed product reference for the floating assistant.
 *
 * Keep this in sync when PRODUCT.md's feature set changes — the model only
 * knows what is written here. Target ~900–1200 tokens; dense reference, not
 * prose. Screen names and enum values must stay exact.
 */

export const PRODUCT_KNOWLEDGE = `CORE OBJECTS
- Space: a workspace with its own stage pipeline. Default: Originals, Edits & Remixes. Switch from the rail; manage in Settings.
- Stage: where a track sits in the pipeline (Idea, Writing, Production, Mixdown, Master, Release Prep, Released by default). Per-space, reorderable.
- Track: a musical work. Fields include type, momentum, deadline, next move, blocked/waiting, BPM, key, tags, notes.
- Version: a bounce/upload on a track. At most 2 unpinned kept; pinned milestones stay. version_no and is_current are DB-managed.
- Project: container — general / single / ep / album / edit_pack. Release types unlock the release workspace.
- Task: actionable item. category: social/outreach/pitching/admin/production/other. status: todo/doing/done. Optional track or project link.
- Session: focus or logged studio time on a track (goal, duration, outcome).
- Comment: feedback on a bounce, optionally timestamped; can be resolved.

ENUMS (exact values)
- momentum: active / simmering / stalled / parked
- track type: original / remix / edit / collab / bootleg
- task category: social / outreach / pitching / admin / production / other
- task status: todo / doing / done
- project type: general / single / ep / album / edit_pack
- collaborator roles: editor (edit metadata/workflow, upload, resolve comments), uploader (upload only), commenter (play + comment), viewer (play + read-only)

MOMENTUM VS STAGE
- Stage = where the track is in the pipeline (Idea → Released).
- Momentum = whether it is moving: active, simmering, stalled, or parked.
- A track can be in Mixing and stalled; stage and momentum are independent. First-timers often confuse them.

WHERE THINGS LIVE
- Today (/): greeting, due tasks, needs-attention list, quick actions, drifting cover strip.
- Board (/board): Kanban by stage for the active space; drag to move stages.
- Tracks (/tracks): list + create/select/delete in the active space.
- Track workspace (/track/[id]): player, versions, guest links, checklist, comments, files, people, layout modules.
- Focus (/track/[id]/focus): distraction-free session — timer, waveform, checklist, scratch notes.
- Projects (/projects): card grid; open one for tracks/tasks; release types get release workspace.
- Tasks (/tasks): Overdue / Today / This week / Later columns.
- Import (/import): conversational catalog intake (also Settings → Import).
- Settings (/settings): spaces, stages, templates, import link, sign out.

HOW TO DO COMMON THINGS
1. Add a track: Board (+ or Add), Tracks, or Today's + Track — title + type; lands in first stage of active space.
2. Move a stage: drag on Board, or click the stage timeline / dropdown on the track page.
3. Upload a bounce: track workspace Versions — "what changed?", set current; wav/aiff convert to mp3 in browser.
4. Pin a milestone: pin a version on the timeline (kept even when unpinned cleanup runs).
5. Blind A/B: select two versions → Blind A/B; labels shuffled until reveal; can log a decision.
6. Start focus: Today or track Workflow → goal + optional checklist → focus screen.
7. Guest review link: track Guest links — pick version, expiry, comment/download; copy link once; no account needed for guest.
8. Timestamped comment: play bounce → "Add comment here" or waveform marker → Comments tab.
9. Invite collaborator: track People — email + role; copy one-time invite link (you share it). Collaborators see that track only.
10. Stage recipe: Settings or stage — automations on enter (checklist, task, next move, momentum, ask decision); preview or automatic.
11. Release credits/CSV: open a release-type project → release workspace track order/metadata → copy or export CSV.
12. Import catalog: /import — chat, files, voice; review plan; only "Build my TEMPO workspace" writes.

WHAT TEMPO DOES NOT DO
- Not a full team workspace — per-track collaborators only.
- No email notifications yet (in-app notification center only).
- Import AI will not search the internet, guess songwriting credits, or invent a release plan.
- Assistant cannot listen to audio, read comment threads, or see files beyond the snapshot.
- No legal, contract, royalty-split, or tax advice.`;

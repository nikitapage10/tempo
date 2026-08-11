# TEMPO — Activation, Reliability, and Pulse product specification

## 1. Product statement

TEMPO already contains the major parts of an artist operating system. This program makes that system dependable and turns its existing capabilities into a repeatable habit.

The target value loop is:

> Bring in a song → name the next move → focus → upload a bounce → get feedback → act on what came back.

The system should help an artist reach that loop without forcing a tour, duplicating their work, grading their productivity, or sending noisy notifications.

## 2. Goals

### 2.1 Reliability

- Protect high-risk user journeys before each production deploy.
- Catch permission, token, migration, upload, and cross-surface regressions automatically.
- Show operators whether required database capabilities and delivery services are healthy.
- Preserve TEMPO's existing manual visual and musical-quality checks where automation is insufficient.

### 2.2 Activation measurement

- Measure whether an artist reaches the core value loop.
- Measure time-to-first-value and return behavior without collecting creative content.
- Identify where onboarding fails as an aggregate product problem.
- Provide event-quality diagnostics so missing or duplicated instrumentation is visible.

### 2.3 Contextual value path

- Give new and under-activated artists one useful next step based on real workspace state.
- Make the guidance optional, calm, and easy to dismiss or snooze.
- Reuse existing actions and screens rather than inventing onboarding-only workflows.
- Stop prompting once the loop has been completed.

### 2.4 TEMPO Pulse

- Bring urgent, useful state back to the artist at a cadence they choose.
- Summarize existing Today, Calendar, collaboration, feedback, and messaging state.
- Prefer one coherent briefing to a stream of transactional email.
- Keep sensitive creative and message content inside the authenticated app.

## 3. Non-goals

- No external Google, Apple, or Outlook calendar sync.
- No mobile push notifications in v1.
- No opaque activation, momentum, productivity, or health score.
- No gamified streak pressure, confetti, badges, or public progress.
- No generic multi-screen feature tour.
- No second task list or copied Calendar records.
- No AI-generated work plan sent without an explicit user request and confirmation.
- No email containing audio, private file links, lyrics, notes, direct-message bodies, support-message bodies, or guest comment text.
- No individual-member analytics drilldown that exposes a creative activity timeline.
- No testing against production Supabase.

## 4. Audiences

### Artist

Needs to understand the next meaningful action and receive a useful briefing without having to maintain another system.

### Collaborator

Needs timely awareness of invited/shared-track work. A collaborator never gains catalog-wide visibility through activation or Pulse.

### Program operator

Needs aggregate activation, reliability, delivery, and failure information while respecting the existing admin privacy boundary.

## 5. Core definitions

### Activated artist

An artist is considered activated when the account has completed these outcomes for any artist identity:

1. At least one track exists.
2. At least one track has a next move, due date, or active blocker/waiting state.
3. At least one focus session is completed.
4. At least one bounce/version exists.
5. At least one feedback loop is completed: a guest review comment, signed-in comment from another user, or recorded version decision attributable to a collaborator/guest.

This definition is for aggregate measurement and onboarding completion. It is not shown as a score and must be versioned because the definition may evolve.

Activation is calculated per artist identity. An account is considered activated when at least one of its artist identities is activated. Admin reporting must label artist-level and account-level funnels separately so multi-artist members are not double-counted accidentally.

### First value

The first moment an artist completes a focus session or receives external feedback after creating/importing a track. Both are retained as separate funnel milestones; the product may report the earlier of the two as time-to-first-value.

### Pulse item

An actionable or awareness item derived at send/render time from authoritative TEMPO data. It is not a copied task or event.

## 6. Contextual value path

### 6.1 Surface and hierarchy

The primary surface is a contained module on Today, below the hero and before secondary decorative content. It is titled **Your TEMPO loop** for a new account and **Keep the loop moving** after the first bounce.

It contains:

- One current recommendation.
- One sentence explaining why it matters.
- One primary action that opens an existing TEMPO flow.
- A restrained progress line expressed as completed outcomes, not a percentage.
- `Not now` and an overflow menu containing `Hide this guide` and `Start over` where applicable.

On mobile it becomes a single full-width card after Tasks due / Needs attention, whichever currently contains urgent work. It must never push urgent overdue work below decorative content.

### 6.2 Step derivation

Progress is evaluated from current accessible data each time Today loads. Recommended order is adaptive:

| Condition | Recommendation | Primary action |
|---|---|---|
| No tracks | Bring in one song | Open Import, with New track as a secondary choice |
| Track exists; no workflow intent on any active track | Name the next move | Open the track's workflow editor |
| Next move exists; no completed focus session | Work one focused session | Open the focus-session starter for the best eligible track |
| No bounce/version exists | Upload the latest bounce | Open the selected track's version uploader |
| Bounce exists; no guest link or signed-in collaborator | Put another pair of ears on it | Open guest link creation; People is secondary |
| Guest link exists; no feedback yet | Waiting for feedback | Open guest links and offer Copy link; do not repeatedly nag |
| Feedback exists and unresolved feedback remains | Close the loop | Open the relevant comment/decision in the track workspace |
| Activation outcomes complete | Loop complete | Show once, then collapse permanently unless restarted |

Selection of an eligible track uses explainable rules:

1. Explicitly blocked/overdue work with a bounce and unresolved feedback.
2. Track with the nearest next-action due date.
3. Most recently updated active track.
4. Most recently created track.

The UI must name the reason in plain language. It must not expose a hidden numeric rank.

### 6.3 Existing members

Existing members see the module collapsed with a single invitation: **Want a quick path through TEMPO's core loop?** It expands only after selection. Their historical records count immediately; they are not asked to repeat completed work.

### 6.4 Dismissal and snooze

- `Not now` snoozes for seven days.
- `Hide this guide` hides it for the current artist until the member explicitly restores it in Settings.
- Completing the loop hides the expanded guide after a one-time acknowledgement.
- Dismissal is per user and artist. One collaborator's choice does not change another person's UI.
- Urgent product errors, migration failures, or support notices never use this module.

### 6.5 Empty and partial states

- If Import is unavailable, offer New track and explain the unavailable action calmly.
- If a selected track is no longer accessible, re-derive rather than showing an error.
- If one source query fails, retain the steps that can be proven and display a quiet refresh action.
- Never mark a step complete based only on a client click. Completion comes from authoritative stored outcomes.

### 6.6 Accessibility

- The current recommendation is a heading inside a named region.
- Completion is expressed in text and icon, never color only.
- Keyboard order follows heading → explanation → primary action → secondary controls.
- Status changes use a polite live region and do not steal focus.
- Animation is limited to the existing restrained TEMPO surface behavior and honors reduced motion.

## 7. Activation analytics

### 7.1 Operator dashboard

Add an **Activation** section to the existing Admin usage analytics surface. It shows:

- Eligible accounts by signup cohort.
- Import started and completed.
- First track, workflow intent, focus session, bounce, share, feedback, and loop completion.
- Median time between milestones.
- D1, D7, and D30 return rates.
- Activation completion by onboarding path: Import versus manual track creation.
- Failure rates for import, upload, guest link, and email delivery.
- Event ingestion health: accepted, rejected, duplicated, and delayed events.

No chart includes titles or other creative labels. Do not offer a click-through to an individual's event history. Small segmented cohorts below five members should be rolled into `Other` or hidden.

### 7.2 Member transparency

Settings → Privacy gains a short **Product improvement data** explanation listing the allowed event categories and explicitly naming excluded content. If a legal/product decision later adds an opt-out, it must not disable security, billing, or essential operational events. The initial implementation should follow the program's existing privacy terms rather than silently inventing consent behavior.

## 8. TEMPO Pulse

### 8.1 Product shape

Pulse is a briefing, not another inbox. It appears in two places:

1. A **Pulse** module on Today that summarizes changes since the member's last meaningful visit.
2. An optional daily or weekly email that uses the same category and priority rules.

The global Notifications center remains the canonical event inbox. Pulse items deep-link into Notifications, Today, Calendar, Messages, or the exact authorized track/project surface.

Pulse scope is deliberately asymmetric:

- The in-app Today module uses the active artist and active-space context, plus global message/support awareness already present in the shell.
- Email sends one briefing per account, not one email per artist. It may aggregate every artist identity owned by the member and tracks explicitly shared with that member.
- When an account has multiple artists, named email sections may group by artist only if `Include track and project names in email` is enabled. The privacy-default digest uses aggregate wording without artist, track, or project names.
- A change of active artist never changes what the member is authorized to receive. Authorization is re-evaluated item-by-item when the digest is generated.

### 8.2 Categories

| Category | Examples | Default email behavior |
|---|---|---|
| Due soon | Tasks, next moves, releases, pitching deadlines, custom reminders | Included in digest |
| Needs attention | Blocked work, overdue next move, unresolved feedback, milestone mismatch | Included in digest |
| Collaboration | Invite accepted, new version, decision, assigned/shared work | Included; high-value events may be immediate if enabled |
| Feedback | New guest feedback, signed-in replies, decision requests | Included; optional immediate email |
| Messages | New artist/support message count | Count only; never include body |
| Calendar | Today's schedule, reminders, conflict summary | Included in digest |
| Progress | Completed focus work, shipped release, resolved feedback | Weekly only by default |
| Product/support | Account or support notices | Outside marketing preferences when operationally essential |

### 8.3 Digest cadence

Settings → Notifications adds:

- Email Pulse: Off / Daily / Weekly.
- Local delivery time.
- Weekly delivery day.
- Timezone, defaulted from the browser and editable.
- Category toggles.
- Immediate high-value email toggles for guest feedback, collaboration invites, and direct/support message awareness.
- `Include track and project names in email`, off by default during beta.
- Pause email until a selected date.

Defaults:

- Existing members: Off until explicitly enabled.
- New invited beta members: Offer a choice after first value; do not pre-check consent.
- In-app Pulse: On, because it is an authenticated product surface.
- Quiet hours apply to immediate emails; digest sends only at its configured time.

### 8.4 Digest composition

Daily digest order:

1. Today and overdue.
2. New feedback/collaboration.
3. Calendar conflicts or reminders.
4. Waiting/blocked work.
5. New-message count.

Weekly digest order:

1. Week ahead.
2. Releases and deadlines.
3. Feedback to close.
4. Work completed.
5. Quiet work that may need a next move.

Limits:

- Maximum five detailed items per section.
- Remaining items are summarized as a count.
- Maximum one primary CTA per section and one final `Open TEMPO` CTA.
- If there is nothing actionable, do not send a daily digest. A weekly digest may send a short calm summary only if the member opted into Progress.
- Digests generated for a member with access removed between scheduling and sending must omit that item at send time.

### 8.5 Email privacy and safety

- Default email uses generic descriptions such as `2 tracks need feedback` and `3 tasks are due this week`.
- Track/project names appear only when the preference is explicitly enabled.
- Message, support, comment, note, and decision bodies never appear.
- Links resolve through authenticated application routes. Do not place private signed storage URLs in email.
- Every non-essential email includes Manage preferences and one-click Unsubscribe links.
- Bounce, complaint, and unsubscribe events stop future optional sends.
- Email bodies are not persisted in TEMPO's database or logs.

### 8.6 In-app Pulse

The Today module shows at most:

- One headline: `Three things changed while you were away`.
- Up to three actionable rows.
- A secondary `See all` link to the canonical destination.

It should not duplicate rows already shown immediately above in Tasks due or Needs attention. If every Pulse item is already visible there, collapse to a small `You're caught up` acknowledgement or hide entirely.

### 8.7 Failure states

- Email delivery failures never block in-app notifications.
- A temporary provider failure retries with backoff and does not create duplicate mail.
- Permanent bounce or complaint disables optional email and explains the state in Settings.
- A scheduling failure appears in Admin health with last-success time and backlog size.
- A member sees only friendly preference status, never provider internals.

## 9. Success measures

### Reliability targets

- Required CI checks pass before merge to main.
- Zero known cross-account/RLS failures.
- Duplicate email rate below 0.1%.
- Scheduler backlog returns to normal within one dispatch interval after a transient outage.
- Core E2E suite completes within a bounded target established during implementation.

### Activation targets

Initial baselines must be measured before targets are finalized. Suggested directional goals after one full cohort month:

- Improve track/import → first bounce conversion.
- Reduce median time to first completed focus session.
- Improve bounce → external feedback conversion.
- Improve D7 return among members who see the contextual guide versus the pre-launch baseline.

Do not run an A/B test until sample size makes the result interpretable. In a small invite-only beta, use staged cohorts and qualitative interviews instead.

### Pulse targets

- Healthy opt-in rate without dark patterns.
- Low unsubscribe and complaint rates.
- Meaningful return visits from digest links.
- Increased resolution of overdue next moves and feedback after a Pulse send.
- No measurable increase in support reports about notification noise or privacy.

## 10. Product acceptance checklist

- [ ] A new artist can reach the core loop using only existing canonical flows.
- [ ] The guide recommends exactly one primary next action.
- [ ] Existing work is recognized; completed steps are never needlessly repeated.
- [ ] Dismiss, snooze, restore, and completion behavior are predictable per artist/user.
- [ ] No score, streak pressure, or copied task/calendar record is introduced.
- [ ] Admin activation charts contain no creative content or individual activity drilldown.
- [ ] Pulse respects cadence, timezone, quiet hours, categories, pause, and unsubscribe.
- [ ] Direct/support message bodies and creative text never enter email.
- [ ] In-app and email summaries deep-link only to data the member may still access.
- [ ] Empty digests are suppressed according to the rules above.
- [ ] Accessibility, mobile layout, reduced motion, and partial-error behavior are verified.

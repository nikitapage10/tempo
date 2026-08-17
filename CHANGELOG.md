# CHANGELOG

Plain-English history of what changed in TEMPO, newest first.

## 2026-08-17

- Fixed (v0.195.1 / Desktop v0.100.27): Dictate genuinely works again everywhere — assistant, Import, Messages, Tasks, Origin, Passage, and Calendar. OpenAI stopped accepting two things TEMPO was still sending, which silently killed every live connection, so dictation always fell back to recording the whole thing and transcribing it after Stop — the long wait you were seeing. Words now appear about a second after you start talking, and Stop finishes the last phrase. Desktop gets this from the web app, so a reload is enough; the matching desktop shell only matters for its own built-in connection.

- Changed (v0.195.0): Dragging on the Board, Tasks lanes, and Pro workflow board is easier to aim. Grab anywhere on a card or row (not just a tiny handle), a bright line shows exactly where it will land, and you can drop between other items in the same column to reorder — not only when moving to another stage or lane.

- Under the hood (v0.194.0): Multi-agent dev now uses three isolated workspace slots (**Workspace 1**, **Workspace 2**, **Workspace 3**) next to the repo. Cursor, Claude Code, Codex, and other agents share one pool and file lock — when all three are busy, the next agent waits until one frees. Run `npm run agent:workspace:status` to see who holds what.

- Fixed (v0.193.0): Dictate works again in the browser and on TEMPO Desktop. The last live-connection change could wait forever on a broken relay, so the mic looked like it was on and never fell back to a recording. Words stream live when the connection opens, and Stop still transcribes a recording if live cannot start.

- Changed (v0.192.0): Dragging a track or note to another stage on the Board now slides it into the new column, so the move is easier to follow. Pro workflow cards do the same between their stages.

- Added (v0.191.0): Tasks and Projects got a full rework. Add a task by typing or speaking it naturally — "pitch to Sam by Friday, high priority, remind me a day before" — and TEMPO reads out the date, priority, assignee, steps, repeat schedule, and reminder as editable chips before saving, so nothing gets misheard silently. Tasks now support priority, a step-by-step checklist with a progress count, reminders, and repeating schedules that regenerate the next one automatically when you close a task out. Click a task to open its full detail in one place. Three views sit over the same list: the familiar Overdue/Today/This week/Later lanes, a sortable List with bulk reschedule/priority/close-out/delete, and a new Timeline. Projects now open on a hero showing status, a deadline countdown, live track/task counts, and overall progress, with a timeline of every date underneath; you can add a new task straight from the project page instead of only attaching existing ones.
  Under the hood: run additive migration 113 in the Supabase SQL editor after 112.

- Fixed (v0.190.0): Dictate on TEMPO Desktop now stays on live transcription instead of dropping to a recording after a moment. Spoken words appear as you talk, and Windows is not asked for extra network permission.

- Changed (v0.189.0): On Social, Add someone in your Top 8 opens a search above that slot, so you can find people you follow and people who follow you without a list appearing further down the page.

- Changed (v0.188.0): Dragging a track or note to another stage on the Board now slides it into the new column, so the move is easier to follow. Tasks do the same when you drag between Overdue / Today / This week / Later, and Pro workflow cards slide between their stages the same way.

- Fixed (v0.187.0 / Desktop v0.100.26): Dictate on TEMPO Desktop now shows your words as you speak — assistant, Import, Messages, Origin, Passage, and Calendar — without a Windows network-permission prompt. The desktop app itself carries the live connection. Update TEMPO Desktop after Desktop Release publishes both installers (Windows and Mac).

- Fixed (v0.186.0): Dictate in the assistant — and the same mic control in Import, Messages, Origin, Passage, and Calendar — no longer asks Windows Defender for public and private network access. Spoken words still appear live as you talk.
- Changed (v0.186.0): The assistant's message box is tall enough to read a full line, grows as you type, and no longer shows a cramped scrollbar inside the field.

- Added (v0.185.0): In a 1:1 artist chat, Add someone starts a new group with that person. You choose whether to include this chat's history; the original conversation stays as it is.
  Under the hood: run additive migration 112 in the Supabase SQL editor after 111.

- Changed (v0.185.0): Messages sits a little shorter on Desktop, so a small zoom no longer forces the whole page to scroll.

- Fixed (v0.184.1): The thin band of moving light along the bottom of the window is gone. The workspace now sits flush to the edge.
- Added (v0.184.1): Pros can reopen Passage from Settings the same way artists reopen Origin. Open Passage returns to the written story; Replay introduction runs the film from the start and offers the Pro page-guide choice again.

- Changed (v0.184.0): Search, notifications, messages, and your profile now line up with the page panels again. The frost behind them still stretches to the window edge when you scroll.
- Changed (v0.184.0): The expanded left menu now uses the supplied TEMPO type artwork beside the light bars, instead of spelling the name in the product typeface.

- Added (v0.183.0): From New message you can start a group chat with several artists, not just a 1:1. Groups sit in their own inbox section, separate from team rooms and Scene chat. The person who starts a group can name it and add or remove people; anyone in it can leave.
  Under the hood: run additive migration 111 in the Supabase SQL editor after 110.

- Changed (v0.182.0): TEMPO Desktop now opens a little larger on high-resolution Windows screens (1440p and ultrawide at normal scaling), so type and controls aren't tiny. Mac Retina stays at 100% because the Mac already enlarges the interface. If you had already picked a zoom other than 100%, that choice is kept; click the percentage or press Ctrl/Cmd+0 to jump back to the new display default.

- Fixed (v0.182.0): On Tasks, the assignee menu now shows the person's name — so assigning a task to yourself in a Pro workspace reads as that name, not **Artist owner**.

- Changed (v0.181.0): Dictation now streams words continuously into editable text on the browser, Mac, and Windows instead of repeatedly stopping and restarting a recorder. Natural pauses create phrase boundaries without ending the microphone session, music-specific terms get extra context, and a failed live connection falls back to one uninterrupted recording so words are not lost between chunks.
- Fixed (v0.181.0): The new Pro Boards now actually reach the live site. A punctuation issue in the empty-state copy stopped the last release from building, so the role-based workflows never made it out.

- Changed (v0.180.1): The expanded left menu again uses the original TEMPO lockup — the color-shifting light bars, a thin line, and the name in the product typeface — instead of sitting the bars against the distressed logo artwork.

- Changed (v0.180.0): Pro Boards now mirror the music workflow instead of repeating Tasks. Passage roles create up to three useful starting workflows—management, A&R, releases, booking, publicity, touring, creative, marketing, publishing, production, or operations—with editable stages and clearly marked example cards. The focused three-stage view opens and collapses stages like the music Board, while people can rename, reorder, add, or remove stages and workflows without changing their Tasks. Run additive migration 109 in the Supabase SQL editor after 108, followed by migration 110.

- Changed (v0.179.0): The once-a-day intro now plays all the way through, with film grain over the picture so it doesn't look soft. Skip sits at the bottom of the screen, and the last two seconds fade into your workspace instead of cutting away. When a page scrolls, the frost behind Search, notifications, messages, and your profile now stretches from the left menu to the right edge of the window and is lighter so the workspace video still shows through. The expanded left menu also keeps the original ice-to-amber light bars beside the TEMPO wordmark.

## 2026-08-16

- Fixed (v0.178.1): Opening **Team room** from an artist's Brief no longer fails with a database conflict error. The room can be created and members added as intended.
  Under the hood: run migration 110 in the Supabase SQL editor after 109.

- Changed (v0.178.0): After Tune in, Sign out and the desktop zoom controls wait a moment, then fade in so they never jump over the opening. The Origin and Passage look step is wider, with the preview beside color, logo, profile, banner, and the network choice, so it stays on one screen. Settings groups those same look controls the same way.

- Changed (v0.177.0): The once-daily post-login intro now uses the new supplied TEMPO film in full. Its built-in logo and soundtrack play as authored, with no duplicate wordmark, grain, or separate theme layered over it, and the workspace transition waits for the film to finish.

- Changed (v0.176.0): The sticky Search, Notifications, Messages, and profile controls now gain a softly fading black-glass backdrop once a page begins scrolling, keeping them distinct from artwork and content moving underneath while leaving the top of the workspace visually open.

- Changed (v0.175.0): TEMPO now uses the supplied distressed white logo instead of rebuilding the name with a font. The real wordmark appears in the expanded studio rail, admin, authentication and welcome screens, download and legal pages, Scenes, public profiles, review links, and invitation pages; compact icon-only controls keep the existing light-bar mark where the wide logo cannot fit.

- Fixed (v0.174.0): **Explore a demo artist first** now completes its handoff reliably in the Mac app. It enters through a distinct server route instead of relying on a direct Origin reload, and an interrupted or partial PRESIDENT build is detected, safely removed, and rebuilt rather than being mistaken for a finished demo on every later attempt.

- Fixed (v0.173.0): The Tempo Theme now starts reliably during both artist Origin and Pro Passage on Mac. Onboarding keeps a rejected or not-yet-ready playback request armed, retries when the file or window becomes ready, and only begins its fade after audio is genuinely playing instead of silently giving up after one attempt.

- Fixed (v0.172.0): The closing Origin and Passage story scroll is substantially smoother on Mac trackpads and Retina displays. Video frames are decoded one at a time at the source frame rate instead of piling up seeks, invisible panels leave the compositor, and expensive glass blur pauses only during active scrolling before returning when the gesture settles.

- Fixed (v0.171.0): Automatic founder-follow notifications now use the artist or Pro name confirmed during onboarding instead of an email-derived placeholder. The confirmed name reaches the network profile before any onboarding follows or social notifications are created.

- Changed (v0.170.0): Creating a task now keeps status, due date, and assignee in the main form so the essentials never hide behind another click. More details is reserved for linking a track or project and adding notes.

- Added (v0.169.0): Task categories are now customizable and color-coded. Each artist or Pro home shares one category palette; people with Tasks write access can rename or recolor the six built-ins, add their own categories, and remove custom ones. The colors follow tasks across Today, project task lists, Tasks, and the Pro Board, while deleting a category safely moves its tasks to Other. Run additive migration 108 in the Supabase SQL editor after 107.

- Added (v0.168.0): Pro accounts now have a Board built for professional workflow instead of songs. Every private Pro Space can move its existing tasks through To do, In progress, and Done, with drag-and-drop, quick add, search, category filters, and project filters; every change stays in sync with the Tasks page. Artist Boards keep their existing track stages and notes.

- Changed (v0.167.0): Pro starter kits are now substantial working setups instead of one-template placeholders. Every Manager, label, publicist, tour manager, agent, assistant, and custom kit now includes two focused views, four detailed role-specific templates or checklists, and two optional example tasks. The richer preview explains every item and lets you open each full checklist before adding it; newly added templates and tasks also appear immediately. People who tried the first kits can add v2 without overwriting anything they kept or edited. Run additive migration 107 in the Supabase SQL editor after 106.

- Added (v0.166.0): Pros can now search published artists from Team → Roster, choose the management or other role they want to offer, add a note, send a request, track its status, and cancel while it is waiting. Artists review those requests on Team → People, can decline without sharing anything, or choose the exact role and access to send back as a normal invitation. The Pro still reviews and accepts that invitation before any workspace access begins. Run additive migration 106 in the Supabase SQL editor after 105.

- Fixed (v0.165.4): A completed Passage now carries its confirmed professional headline, introduction, roles, day-to-day work, and career story into the Pro profile instead of leaving an empty “Build profile” page. Existing completed Passage accounts repair themselves when Profile opens, direct answers stand in if the writing step was empty, and anything the Pro has already edited is preserved.

- Fixed (v0.165.3): A Pro's profile page now shows the profile photo they chose during Passage instead of falling back to initials while the same photo appears in the top-right menu. Future changes to that personal-workspace photo also stay aligned with the identity shown to artist teams.

- Fixed (v0.165.2): Passage now reveals the same quiet Sign out control as Origin after Tune in, and TEMPO Desktop also shows the same bottom-left zoom controls so Pro onboarding text and panels can be resized without leaving the film.

- Fixed (v0.165.1): Team Operations migration 104 now applies cleanly to databases that already contain calendar events. The creator backfill no longer trips the signed-in-owner trigger when GitHub Actions runs as the database migration user, and it preserves existing event edit timestamps. The trigger swap and backfill are one atomic transaction, so a failed attempt rolls back safely and the migration can be retried after the partially applied v0.165.0 run.

- Added (v0.165.0): Team Operations is live in the shared app. Invitations now show the exact ten-area access summary before send and approval; membership supports suspension, resumption, attributable history, and offboarding preview; Tasks support eligible team assignees and narrow assignee status updates; Pros get a private cross-artist My Work queue, combined schedule, availability, roster, and optional preview-first role starter kits; artists get People, Brief, and Waiting tabs plus one private team room inside Messages where everyone speaks as themselves. The package also completes Pro identity/handle editing, multiple private Pro Spaces, Pro-specific tours/checklists/email language, correct demo startup, message attribution, and dual artist+Pro identities on one login. Deploy additive migrations 098–105 in order, with migrations 101–105 gated until the direct non-production RLS matrix passes; no database reset or destructive rollback is required.
- Fixed (v0.164.3): Accepting a team/Pro invitation no longer converts an established artist workspace into the person's professional home. `legacy_complete` now counts as a finished artist everywhere, so one login can correctly hold **My artist**, a separate **My work** Pro home, and the artists that person works with. Migration 100 safely restores already-affected artist rows that predate their first Pro invitation and adds a distinct personal home without moving or deleting catalog data.
- Fixed (v0.164.2): Pro accounts now start and resume in their own personal workspace instead of being promoted into an existing PRESIDENT demo. Choosing Explore demo still opens it immediately and keeps it available in the switcher, but the choice is scoped to that signed-in account and that explicit handoff; a later login returns the Pro to their real Home rather than sample data.
- Fixed (v0.164.1): A Pro's tour decision now stays decided after logout, reload, device changes, and workspace switching. Pro guide preference is stored separately from the artist Origin tour, Skip all affects only the Pro guides, and an unfinished artist-tour handoff from another account can no longer open over a professional workspace. Run migration 099 before deploying.
- Added (v0.164.0): Pro profiles are now full professional identities instead of name-and-photo cards. Pros can claim or change a handle, write an introduction and headline, list roles, location, pronouns and links, describe their current focus, build an editable career story, choose who can message them, and control member/public visibility. Passage offers handle creation and supplies an editable first draft; public Pro pages use career language and never pretend the person is an artist or show releases. Run migration 098 before deploying.
- Added (v0.163.0): Pro accounts can now create, switch, rename, reorder, and delete multiple private Spaces from the rail and Settings. Each Pro Space keeps its own projects, tasks, and calendar work inside the Pro home, separate from every artist they work with; Pro Spaces stay focused on professional work rather than exposing artist Boards or Tracks.
- Fixed (v0.162.5): Opening Messages from a Pro workspace no longer labels Nikita's welcome conversation with another artist owned by the recipient. Direct-message names, unread counts, and sent-message sides now follow the two account participants, so changing between Pro and artist workspaces cannot swap who appears to be speaking.
- Fixed (v0.162.4): Pros are no longer dropped directly into page-by-page tours or treated as though they should take the artist workspace tour. After Passage they now make one clear choice—show the short Pro-specific guides or skip all tours—and no Pro guide opens before that choice. Artist accounts keep their existing post-Origin tour decision.
- Fixed (v0.162.3): Pro accounts no longer receive the artist Getting started checklist asking them to upload a tune, shape an artist board, review artist stats, or connect Spotify. Their six first moves now focus on their professional profile, artist relationships, follow-ups, dates, working views, and notification signal, with wording tailored to the roles they selected in Passage—including labels, collectives, publicity, touring, management, creative, production, publishing, and assistant work.
- Fixed (v0.162.2): Passage now reliably plays the Tempo Theme. Fresh sessions still begin it with Tune in, while resumed and reduced-motion sessions start it on the first browser interaction or immediately in TEMPO Desktop. Merely opening the waking screen no longer creates an empty draft that skips the sound-starting moment next time.
- Changed (v0.162.1): Designed optional role-based starter kits for Pro accounts. Manager, label, publicist, tour manager, agent, assistant, and custom paths can preconfigure a private Pro home with role-relevant views and reusable templates after an itemized confirmation; multi-role kits combine safely, never grant artist access, and never overwrite edited work. This is architecture and product design only—the starter kits are not live yet.
- Added (v0.162.0): Onboarding now asks whether you want to be on the member network, on the same screen where you pick your colors, logo and profile image. Private is the default and stays a real answer: nothing is shared, and you can join later from Social whenever you feel like it.
- Added (v0.162.0): Choosing to join the network now asks you to pick your handle right then, wherever you join from. The handle is checked as you type, so you find out a name is taken while you're still choosing rather than after pressing Join. Handles were previously only required for a public link, which left members on the network that nobody could @mention or link to.
- Fixed (v0.162.0): "Explore a demo artist" now actually opens the demo. Building it used to drop you straight back at the first Origin chapter, because onboarding did not recognise the sample workspace and sent you back to finish your own. Removing the demo puts you back where you were, unfinished Origin and all.
- Fixed (v0.162.0): The dark blocky patch around the light at the very start of Origin is gone. The opening film's black was very slightly lifted off true black, so the compression blocks around the bright line showed as hard-edged squares on high contrast screens, Macs especially. The clip and its still have been re-mastered to true black.
- Fixed (v0.162.0): Origin no longer arrives with "Artist Name" already typed into the name field. It now sits behind the field as a prompt and disappears as soon as you type, instead of being something you have to delete first.
- Changed (v0.162.0): Origin is noticeably lighter to scroll, especially through The Story. Chapters you have scrolled past are now dropped from the screen properly rather than left invisible but still being drawn, and the film grain is moved a cheaper way. This was the bulk of the lag on the scrolling chapter.
- Changed (v0.162.0): Dictation puts your words on screen much sooner. The first phrase now lands in about a second instead of after several, and later phrases are sent off in shorter stretches. This mostly affects the desktop app, which records and transcribes rather than using the browser's own live dictation.
- Changed (v0.162.0): Invitations and the welcome screen now present the desktop app and the browser as two full versions of TEMPO rather than one real option and a fallback. Desktop is still listed first and says what it's better at, but the browser is offered at the same weight, with the same account either way.
- Fixed (v0.161.3): Pro invitation emails now welcome the recipient through Passage and their professional home instead of telling them to introduce an artist through Origin. Artist invitations still keep their Origin onboarding language, and the admin preview now reflects the selected role.
- Changed (v0.161.2): Planned the next Team Operations layer in full before building it. The plan now covers clearer Pro and team-role language, honest access controls, assigned work across artists, safer joining and leaving, an artist Team Brief, a private team room, and a multi-artist work and schedule home. These are designs for the next build packages; no new team behavior or database step ships in this version.

## 2026-08-15

- Fixed (v0.161.1): Origin's lines no longer ride up to the top of the screen. Every question, panel and line of narration now sits in the same place, centered against the middle-right of the film, instead of some copy floating at the top and some drifting into the middle.
- Fixed (v0.161.1): Bringing your music in no longer draws a huge empty panel around a small amount of content. The import panel is now only as tall and wide as what's actually in it, growing as needed and staying inside the screen.

## 2026-08-14

- Changed (v0.161.0): The Story chapter in Origin no longer has its own inner scrollbar. Scrolling the page carries you through its sections the same way it does everywhere else.
- Added (v0.161.0): You can now sign out of Origin partway through, instead of being stuck once the film starts. A quiet sign-out button (next to the zoom control on desktop) fades in once you've tuned in.
- Fixed (v0.160.4 / Desktop v0.100.25): Signing out and closing TEMPO no longer leaves the login music playing in the tray. The app still sits in the background; it just goes quiet until you open it again. Update the desktop app after Desktop Release publishes both installers (Windows and Mac).
- Fixed (v0.160.3): Origin and Passage story chapters no longer clip their last cards or opening lines. If a chapter is taller than the screen, it scrolls inside the glass — including The Story — instead of cutting off with no bar, and decorative rings no longer overlap the words or fake a second scrollbar.
- Fixed (v0.160.2): Signing out and into a different account no longer leaves the previous catalog, artist, or permissions on screen. Admin portal, “who you’re working as,” and the rest of the workspace now belong to the account you just signed in as — on the web and on TEMPO Desktop — without needing a refresh. Each account still remembers its own artist, so coming back to PRESIDENT does not dump you onto an empty Home. The catalog was not deleted.

## 2026-08-13

- Fixed (v0.160.1): Origin and Passage no longer run off the screen. Question panels, the story chapters, and especially the Spotify import list now stay on the film — if there's more than fits, they scroll inside the glass, and Continue stays reachable.
- Fixed (v0.160.0): Passage never started for Pros. On the very first sign-in, before your workspace had been created, TEMPO could not tell you apart from a brand-new artist and sent you to the artist onboarding instead. The desktop app made it worse by always going straight to artist onboarding regardless of who you were. Both are fixed, and the desktop app now follows the same single rule the web app does.
- Added (v0.160.0): Pros get their own **guided tour** through the app, in the same style as the artist one but written for the work you actually do. Today, Calendar, Projects, Tasks, Profile, Artists, Social, Scenes and Settings each have their own. Previously Pros were never offered a tour at all, because the app was waiting on an artist step that Pros never reach.
- Added (v0.159.0): On Social → Discover you can **invite an artist friend** who isn’t on TEMPO yet. That request waits for program approval during beta, then TEMPO emails them if it’s approved.
- Added (v0.159.0): On Team you can invite someone **already on TEMPO** by their handle or email. They get a notification, and they have to approve before they join your artist team. People who aren’t on TEMPO yet still get the email invite as before.
- Under the hood (v0.159.0): run migration 097 in the Supabase SQL editor after 096.
- Changed (v0.158.0): Creating an account no longer asks for your name. Onboarding already does, so you were being asked twice within a minute. Passage now owns it, and still publishes it so artists you work with and people on Social see your name rather than a placeholder.
- Added (v0.158.0): You can **talk instead of type** on every open question in Passage, the same as artists can in Origin. Typing stays an equal path: what you say lands in an ordinary editable box, so a blocked microphone costs you nothing.
- Fixed (v0.158.0): Passage panels are now properly solid against the film. The fill was written in a form that can silently compile to nothing in this codebase, so the glass had been rendering with almost no tint at all. Question text is brighter too, so it holds up over the brightest frames.
- Fixed (v0.158.0): Admin **Members** and the member detail page said "Team member". They now say Pro, along with the invitation email.
- Changed (v0.157.0): People who aren't artists are now called **Pros**, not "team members". They hold too many different roles for one label: manager, label owner, collective founder, A&R, publicist, creative director, visual artist, photographer, engineer. The admin invite now offers Artist, **Pro**, or Admin.
- Changed (v0.157.0): Passage now opens by asking your **name**, then what describes you, and you can **pick as many as fit** instead of one. Most people wear more than one hat. The list covers everything from label owner and collective founder to photographer, engineer and marketing, with room to write your own.
- Added (v0.157.0): The closing scroll of Passage is now **written for you** rather than read back to you. TEMPO takes your answers, finds the thread through them, and tells it as one short story with a headline and an introduction you can edit before it's kept. If it can't write for any reason, your own answers stand in, so the ending is never blank.
- Fixed (v0.157.0): Passage panels are much more opaque, so headings and typing are readable over the brightest parts of the film instead of being cut in half by it.
- Fixed (v0.157.0): Your profile photo now shows in the top-right avatar when you're a Pro. It was only looking at your Social profile picture and ignoring the photo you set in Settings → Look.
- Fixed (v0.157.0): The database step that ships the Pro fixes now applies. It referred to a column that doesn't exist and was failing, which meant none of the v0.155.0 changes were live. Under the hood: run migrations 095 and 096 in the Supabase SQL editor after 094.
- Added (v0.156.0): Creating an account asks for **your name**, so artists you work with (and follow notifications) see you — not a leftover label like Home.
- Changed (v0.155.0): **Passage**, the Pro welcome, is now the same for everyone joining a team, whether an admin invited them from the console or an artist added them from Team. It no longer borrows the artist's questions: it doesn't ask for an artist name, doesn't talk about your "signal", and never asks you to bring music in. Instead it asks what describes you, from label owner and collective founder to visual artist, photographer, engineer or publicist, then what got you into the industry, who you support, and what you actually do day to day. Every question can be passed, and **Skip for now** leaves the whole thing at any point. You still get to set your colors, logo, profile image and banner for your own workspace. Track collaborators, people added to comment on one song, are not put through it.
- Fixed (v0.155.0): A Pro now lands in a Pro's workspace instead of an artist's. No Tracks or Board in the left menu, no artist identity editor. Just Today, Calendar, Projects, Tasks, Profile, **Artists**, and Social, as intended. Pros who were already given an artist-shaped workspace by mistake are moved over automatically, as long as no music was added to it.
- Fixed (v0.155.0): The look preview now actually shows your banner, logo *and* profile image together, instead of collapsing to a thin strip where only the banner was visible. This affects the artist onboarding too.
- Added (v0.154.0): When an admin formally invites someone as a **Pro** (not an artist, so a manager, label owner, collective founder, or anything in between), accepting the invite opens **Passage**: a short, cinematic welcome in the same style as Origin, using the same film and the same scrolling story. Under the hood: run migrations 094, 095 and 096 in the Supabase SQL editor after 093.
- Fixed (v0.153.3): Hovering Artist for Stats (or Social for Scenes) still keeps that menu if you cut across the tab underneath — but switching Artist → Social is instant again. The old pause before the other menu could open is gone.
- Fixed (v0.153.2 / Desktop v0.100.24): On TEMPO Desktop, **Open web app** opens your normal browser at the same page — it no longer opens a second TEMPO window. Launching the app again (Start menu, Dock, or installer) focuses the one that’s already running. Windows and Mac get this together; update after Desktop Release publishes both installers.
- Fixed (v0.153.1): Asking TEMPO to also invite a collaborator as a full artist no longer claims you don’t own the track when you do.
- Added (v0.153.0): On a track’s People tab you can **include a TEMPO artist** — someone you follow, or anyone you find by handle — or still **invite by email**. Included artists are on that track right away; email invites still use the one-time link.

- Fixed (v0.152.2): If you already have a TEMPO login as a team member and then accept an artist invite, Origin starts on your new artist instead of dropping you back into the manager home. After Origin, the switcher has your artist, your home, and **Artists you work with**.
- Fixed (v0.152.1): Hovering Artist for Stats (or Social for Scenes) no longer loses the menu if your pointer brushes the tab underneath. The first menu still opens right away; a neighbor has to wait a beat before it can take over.
- Added (v0.152.0): **Artists you work with** now has a roster overview — overdue deadlines, what’s coming this week, catalog size, and follower counts (where you’ve been granted those areas) — above the same **Enter workspace** cards as before.
- Fixed (v0.152.0): From Discover, opening another artist as a team member takes you to their profile instead of dumping you on Artists you work with.
- Changed (v0.151.0): When a team member joins Social, they and their artists follow each other automatically. The Social globe shows the same cropped crest as an artist page, instead of a full ball.
- Changed (v0.150.0): Team photos are larger, and the fan of cards sits in a tighter frame instead of a tall empty box.
- Fixed (v0.149.0 / Desktop v0.100.23): Google and Microsoft sign-in on TEMPO Desktop come back into the app after you finish in the browser. The return no longer depends on the browser agreeing to open a `tempo://` link. Update the desktop app after Desktop Release publishes (Windows and Mac).
- Changed (v0.148.0): Achievements now lists every one you've unlocked — if it says 15 of 101, you can scroll those 15, not just the first eight. **Show full catalog** still shows the whole set, grouped by grade; earned ones sit lit on the ice-to-amber flare, locked ones are dashed and dim so you can tell them apart at a glance.
- Fixed (v0.147.0): If you already have a TEMPO login as a team member and later get an artist invite to the same email, **Use the web app** now recognizes that account. Sign in with it — you are not asked to create a second login — and Origin starts so you can set up your own artist. Your manager home stays. If you were already signed in, the invite still applies instead of dumping you on Today.
- Changed (v0.146.0): Hover **Artist** for Profile, Team, and Stats — clicking Artist still opens your profile. Team photo cards are larger, with the artist in front and everyone else behind to the side. The old “Your work / Work” labels are **Home** (or your own name). Managers can join Social and Scenes as themselves, and Settings now has a **Look** tab for name, photo, logo, banner, and colors. During beta, inviting someone as a full TEMPO artist waits for your approval on Admin → Invites (**Needs approval**); team and collaborator invites still go out immediately and show under **Invites by others** as “Nikita Page invited …”. A track collaborator can comment from a guest link with no account, join as a simple collaborator on that track, or ask TEMPO to invite them as an artist. Under the hood: run migration 093 in the Supabase SQL editor after 092.
- Changed (v0.145.0): The left menu is shorter. Hover **Artist** for Team and Stats; hover **Social** for Network (the social page) and Scenes. On a phone those still live under More.
- Fixed (v0.145.0): Accepting a team invite no longer creates an Artist profile named after your email. If you're a manager, you get your own home and an **Artists you work with** hub — not a second artist called something like "music." Settings will not keep adding extra artist profiles when you try to set a photo; that lives on **Profile**. On Team, the artist sits front and center with everyone else fanned behind. Extra artist profiles that were created by mistake are folded back into that home.
- Fixed (v0.144.1): The team-access database step can be re-run without failing — it was blocking the rest of the schema from applying.
- Changed (v0.144.0): Team members now sign in as themselves, not as a guest inside the artist's screen. They get their own home — Today, projects, tasks, calendar, a Profile page for their name and photo, and Social as themselves — plus **Artists you work with**, a hub with a snapshot of each artist who's brought them on and **Enter workspace** when they need to do the work. Inside that workspace a bar says they're working on you as Manager (or Agent, and so on) with **Back to my work**; they only see the tabs you've granted, your artist page is read-only, and Settings is just Account. Team is its own item on the left rail under Artist, with the team fanned out as photo cards. If the same person is an artist *and* a manager, one login switches between My artist and My work; on Social they show up once, with badges for the hats they wear. Under the hood: run migration 092 in the Supabase SQL editor after 091, on a non-production project first.

## 2026-08-12

- Fixed (v0.143.0): Inviting someone to your team who doesn’t have a TEMPO account yet no longer dead-ends on “Sign in to accept.” The invite page now says **Create an account** when that email is new (and **Sign in to accept** when they already have one), and they can set a password without an invite code — the team invite *is* the invite. After they create the account they’re on the team, not sent through Origin.
- Changed (v0.142.0): Team moved out of Settings and into its own page —
  reach it from Artist → **Team**, or the artist switcher. It opens on a
  visual of your team: your artist at the center, everyone who works with
  you fanned out around it, their own photo if they've set one. Team invite
  emails now actually send (the same way an artist account invite does)
  instead of only producing a link to copy and paste yourself — the invited
  person creates a real TEMPO account the normal way, they just don't go
  through Origin, since they're not onboarding as an artist. A team member
  now has their own name and photo, separate from any single artist they
  work with, editable from their own view of the Team page. If someone owns
  their own artist *and* works another artist's team under the same email,
  the artist switcher now labels which entries are theirs and which are a
  role (Manager, Agent, etc.) so switching between them is unambiguous.
  Under the hood: run migration 091 in the Supabase SQL editor after 085–090,
  on a non-production project first.
- Fixed (v0.140.1): Admin’s moving wash stays put when you zoom the page — it was sliding with the content.
- Changed (v0.140.1): **Back to TEMPO** stays on the left Admin menu while you scroll.
- Added (v0.140.0): **Team** — under Settings → Team, bring on a manager,
  agent, tour manager, label contact, or assistant at the artist level
  instead of one track at a time. Each role starts with sensible defaults
  (an agent gets calendar and performances, a label contact sees releases
  and stats but nothing hands-on) and you can adjust any grant afterwards,
  area by area. Invite by email, they accept the same way a track
  collaborator does, and what they see in the rail follows what you've
  granted — no calendar access means no Calendar tab. Your personal
  attributes, points, and achievements always stay yours alone, no matter
  what's granted. Under the hood: run migrations 089 and 090 in the Supabase
  SQL editor, in order, after 085–088, on a non-production project first.
- Changed (v0.140.0): Artist attributes now opens in a compact view by
  default — six honest figures, no radar — instead of leading with the full
  hexagon on first visit; switch to Full for the radar and the deeper
  breakdown whenever you want it. Achievements now shows only what you've
  actually unlocked by default (it used to list every one of the ~101
  possible achievements, locked or not, which made the page scroll forever)
  — "Show full catalog" reveals the rest, grouped by grade. Fixed a label
  overlap on the attribute radar where two axis names could run into each
  other. Removed the duplicate compact attribute list from the Artist page —
  attributes live in one place (Stats) now, not two.
- Added (v0.139.0): Stats has an **Artist attributes** section — six figures
  (Output, Velocity, Follow-Through, Consistency, Stage Presence, Reach)
  built entirely from things you actually did: bounces uploaded, tracks
  finished, sessions logged, shows played, platforms linked. Tap any one to
  see exactly what earned it — nothing here is a guess or a hidden score.
  Real actions (finishing a track, moving one forward, logging a show) earn
  points toward these, and milestone moments now pop up as **achievements** —
  about a hundred of them, from the first bounce you ever upload to a full
  year of consistent work — graded Glimmer through Corona along the same
  ice-to-amber flare TEMPO already uses, with a few hidden ones that stay
  unnamed until you earn them. If you've used TEMPO for a while, your
  existing history (finished tracks, focus sessions, Origin, the
  getting-started checklist) counts retroactively the first time you open the
  page — nothing starts you at zero. A **Live** section lets you log shows
  and festivals you've played (and pull in past calendar entries you tick
  off yourself), which is what feeds Stage Presence. All of this is personal
  — never shown on your public artist page — and can be turned down to a
  plain figures list (or hidden entirely, like any other Stats section) from
  the module's own controls. Under the hood: run migrations 085 through 088
  in the Supabase SQL editor, in order, on a non-production project first.
- Changed (v0.138.0): Stats has a clearer sense of what matters. **The year in
  bounces** now leads the page as a bigger, framed section instead of sitting
  level with everything else; Spotify, SoundCloud and Apple Music are grouped
  into one tabbed card instead of three stacked ones; and the small "Catalog"
  and "Feedback received" panels are combined into one compact "Signals" card.
  Your own saved layout (if you've customized Stats) is preserved — anything
  new just shows up once, ready to move or hide like everything else.
- Changed (v0.137.0): dragging a task over a column now says **Move to today / this week / later / overdue** in that box, so you can see where it will land.
- Changed (v0.137.0): **Closed out** sits under the task columns instead of next to the page title.
- Added (v0.136.0): on Tasks, drag a to-do from one column to another to change when it’s due — Today sets today; This week, Later, and Overdue ask which date.
- Changed (v0.136.0): finished tasks no longer sit faded under the board — **Closed out** in the header (or Show → Closed out) is a list of everything you’ve checked off in this space.
- Changed (v0.136.0): the Admin home now sits on the same softly blurred video wash as Today, with frosted glass, a greeting hero, live support and moderation queues, recent admin actions, and a jump-search to find a member without leaving the page.
- Added (v0.136.0): Admin has a System page for operational health — invite email setup, schema, product-event counts, and Pulse delivery queues — status and counts only, never secrets or private work.
- Fixed (v0.136.0): Calendar events show the same cursor-following edge light as tracks and tasks — the glow was being clipped off the pill.

- Fixed (v0.135.5): release checks now prepare their isolated test data before
  running, catch new duplicate migration numbers before a change lands, and
  run again after changes reach main. Two older shared numbers (080 and 058)
  stay as they are — no database action needed.
- Changed (v0.135.4): on Calendar’s day panel, **New event** sits right under the date instead of at the bottom of the panel.
- Fixed (v0.135.3): Admin gets more space at the top of the page so header controls (like the analytics day toggle) sit clear of the window edge — same on the web and in TEMPO Desktop.
- Added (v0.135.3): on TEMPO Desktop, Admin shows the same bottom zoom control as the studio, so ops pages can enlarge without leaving Admin.
- Fixed (v0.135.2 / Desktop v0.100.22): Google and Microsoft sign-in on TEMPO Desktop hand back into the app again — the sign-in code is finished inside the desktop window (where it was started), Windows keeps the `tempo://` return link, and long Google URLs aren’t blocked from opening your browser. Re-download after Desktop Release publishes. Confirm Supabase allow-lists `https://mytempo.dev/auth/desktop-bridge`.
- Fixed (v0.135.2): sign-in Tempo Theme plays every visit again on TEMPO Desktop (logout / reopen — it isn’t once-a-day; that’s only the boot film after you’re in), starts as soon as the track is ready in the shell, and on the web warms sooner so you’re not waiting ~6–7s while it fights the intro preload.
- Fixed (v0.135.2): Origin’s Look preview keeps the banner logo fully visible (especially on desktop), and the Logo / Profile rows show a live thumbnail on the left.
- Fixed (v0.135.2): Shape the Workspace during Origin import scrolls all the way down again — you can reach **Review what gets built** / continue instead of getting stuck mid-list.
- Added (v0.135.2): on TEMPO Desktop, Origin shows the same bottom-left zoom control as the studio, so onboarding type can be enlarged without leaving the film.
- Changed (v0.135.2): Bring your music in stops after the basics instead of endless follow-ups — once TEMPO has enough to draft a workspace, it tells you to hit **That’s everything** or keep adding detail only if you want.
- Changed (v0.135.1): desktop work stays Mac and Windows together — same shell version, same capabilities; releases must publish both installers before we call them done.
- Added (v0.135.0): Admin has a clear **Back to TEMPO** path back to your normal studio (Today).
- Changed (v0.135.0 / Desktop v0.100.21): the live address is **https://mytempo.dev** — auth redirects, invites, PWA, and TEMPO Desktop now use that domain (the old Vercel address still works as a spare allowlist entry on desktop while installs update). Set `NEXT_PUBLIC_SITE_URL=https://mytempo.dev` in Vercel if it isn’t already. Re-download after Desktop Release publishes.
- Changed (v0.134.2): the profile menu’s desktop link matches where you are — **Open web app** inside TEMPO Desktop, **Open TEMPO** in the browser when desktop is already installed, otherwise **Download TEMPO**. Platform admins also get an **Admin portal** item there.
- Fixed (v0.134.2): artist banner photos on Today, Artist, and Stats read clearly again — they were washed almost black by a too-heavy glass overlay.
- Fixed (v0.134.2): Calendar month days no longer grow tiny scrollbars inside the cell — titles clip cleanly, and extra items stay behind **+N more**.
- Fixed (v0.134.1): the toolbar profile button is your artist photo (the same emblem as on Artist), filling the circle — not a blank icon chip.
- Added (v0.134.0): a profile button next to Messages — open your artist profile, Stats, Settings, or Download TEMPO, or sign out, without digging through the rail.
- Fixed (v0.133.1): desktop zoom no longer leaves a black strip beside the left rail, and menu text only grows with zoom when the wide labeled rail has room (the narrow icon rail stays put).
- Changed (v0.133.0 / Desktop v0.100.20): the left rail stays usable when you shrink the window or zoom — below a wide breakpoint it collapses to icons (with initials for artist/space), and on TEMPO Desktop the zoom control / Ctrl± only scales the main workspace so nav buttons don’t shrink with the page. Re-download after Desktop Release publishes.
- Changed (v0.132.0): search understands tempo more clearly — try `bpm 140`, `140 bpm`, or a range like `140-150` / `bpm 140 through 150` to list tracks in that speed, without every song that merely mentions “BPM” in a note crowding the results.
- Fixed (v0.131.0 / Desktop v0.100.19): Google and Microsoft sign-in on TEMPO Desktop open in your normal browser again (so those providers stop blocking Electron as “not secure”), then hand you back into the app. Update the desktop app after Desktop Release publishes, and add `/auth/desktop-bridge` to the Supabase redirect allow-list (see OAuth setup notes).
- Changed (v0.130.0): covers, logos, and scene banners show up faster in the browser — TEMPO keeps a Spectra / tint placeholder while art finishes loading, signs many track covers in one go instead of one-by-one, and quietly warms pictures after you sign in so the next page feels less empty. Scenes and Social art also skip a wasted failed sign before the working link.
- Fixed (v0.129.1 / Desktop v0.100.18): on Mac, the new-message glass toast still shows when another app (or TEMPO) is in fullscreen. Re-download after Desktop Release publishes.
- Fixed (v0.129.1): Calendar month view keeps the whole month on screen — day cells shrink to fit the window instead of pushing the last weeks off the bottom (especially in the Mac app).
- Added (v0.129.0): on Tracks, Select is no longer delete-only — tick a few tracks and Group them (move into an existing album/EP bucket, ungroup, or make a new group from the selection), move them to a Stage, add them to a Project (or pull them off one), or still Delete with the same confirmation. Select all / Clear are right there in the bar.
- Fixed (v0.128.2 / Desktop v0.100.17): the Mac app opens again — the last DMG left out a small helper file the shell needs to start. Re-download after Desktop Release publishes.
- Fixed (v0.128.1 / Desktop v0.100.16): Blind A/B on TEMPO Desktop keeps your scrub position when you hit play — seeking a bounce no longer jumps back to the start. Update the desktop app after Desktop Release publishes.
- Added (v0.128.0): on TEMPO Desktop, track covers, album/EP covers, scene banners/emblems, and artist logos quietly save into the local vault after you sign in — so the next time you open those screens they load from this computer instead of re-downloading every picture. (Web is unchanged.)
- Fixed (v0.127.1): the quiet Tempo Theme bed on sign-in actually plays again — the soundtrack file was being blocked for people who weren’t signed in yet, so the page stayed silent. Click or type once on login / create-account to start it.

## 2026-08-11

- Fixed (v0.127.0 / Desktop v0.100.15): Google and Microsoft sign-in complete inside TEMPO Desktop again (they were bouncing out to a browser tab, so the desktop app never got the session). The stuck Redirecting… lock on the login buttons is cleared if you cancel or come back. Re-download / update the desktop app after Desktop Release publishes.
- Changed (v0.127.0): on TEMPO Desktop, wav/aiff bounces stay in their original format in the local vault; TEMPO only converts to mp3 when syncing the newest cloud copies (the cloud itself never stores wav). The browser upload path is unchanged — it still converts before upload.
- Added (v0.127.0): sign-in carries a quiet Tempo Theme bed (starts on your first click or key), and the once-a-day boot film plays the same soft soundtrack underneath. New-message glass toasts follow your active artist's Cool / Warm colours. On Messages itself they stay quiet — the thread just updates (and jumps to the conversation when needed) instead of stacking another popup over the chat. On TEMPO Desktop, Social's globe shows about two-thirds of the sphere instead of nearly the whole ball. Scene banners, scene photos, and artist profile images keep a stable signed link for the session (and mirror into the desktop vault after the first open), so revisiting Social or Scenes doesn't re-download every picture from scratch.
- Fixed (v0.126.1): Origin's Look preview gives the banner, logo, and profile room again - taller banner strip, logo contained inside it, profile sitting below so nothing looks cropped on desktop.
- Fixed (v0.126.0 / Desktop v0.100.14): the Windows install wizard side panel and header now say TEMPO only - the leftover Desktop label in the artwork is gone. Re-download after Desktop Release finishes.
- Fixed (v0.125.1): Download page glass reads more clearly over Spectra, and the Windows / Mac buttons no longer overlap.
- Changed (v0.125.0): Download (Windows and Mac) always follows the newest public installer as soon as Desktop Release publishes it - no waiting on a separate web bump. The page shows that live version next to the buttons.
- Changed (v0.124.0): the public Download page and invite email match TEMPO's glass look more closely. Invites now lead with **Download TEMPO**, with **Use the web app** as the quieter option, and still include the copy-paste links if a button fails. Download buttons also point at the fixed Windows installer (v0.100.13) without a browser quirk that could leave you on the broken build.
- Fixed (v0.123.0 / Desktop v0.100.13): the Windows app opens again - the last installer left out a small helper file the app needs to start. Download and the install wizard now just say TEMPO (not TEMPO Desktop).
- Added (v0.122.0): desktop installers stay current without a manual publish dance - when a native shell change lands on main, Desktop Release builds Windows and Mac for the public download channel; a daily catch-up fills in anything that was missed. Opening TEMPO Desktop still checks for the newest build on first launch (and every few hours after). Download links on the web prefer that newest public installer, with the older Windows beta as a backup if the channel is empty. The Download page works from an invite link without signing in first.
- Fixed (v0.121.0): production build succeeds again - a glass message toast
  helper was named like a React Hook and tripped the Vercel typecheck.
- Changed (v0.121.0 / Desktop v0.100.12): the Windows desktop download now opens
  a proper install wizard — welcome screen, choose the folder, optional
  shortcuts, then Finish — with TEMPO’s dark Spectra look on the side panel.
  Run **Desktop Release** to publish the new installer.
- Fixed (v0.120.1): the browser now shows the same glass **new message**
  popup as desktop (bottom-right, above Get help). The mistaken “TEMPO update
  is available” card on the web was removed — updates stay a desktop-only
  prompt.
- Added (v0.120.0): **Download for Mac** is wired up — Desktop Release now
  builds an unsigned universal Mac app on GitHub Actions (no Mac on your desk
  required). Gatekeeper will warn the first time; right-click → Open. Run the
  Desktop Release workflow once so the DMG is actually on the download channel.
- Changed (v0.119.6): Social’s globe sits higher, and after the first spin it
  gently tips so Australia and southern South America come into view before
  settling back. The “Scroll to zoom · drag to spin” line is readable again.
- Fixed (v0.119.5): Social only keeps the center **Join as TEMPO member**
  button when you’re off the network — the header and Feed duplicates are
  gone.
- Added (v0.119.5): *(superseded by v0.120.1)* an earlier web “update available”
  card was a misread of the request; message alerts are what belong on the web.
- Fixed (v0.119.5): Download / Update TEMPO Desktop works again — the
  GitHub release channel wasn’t published yet, so the link 404’d; it now
  serves the working Windows installer from TEMPO itself.
- Fixed (v0.119.4): Origin’s **The Story** chapter scrolls with the page —
  you no longer have to hunt for a scroll box inside the window, and the odd
  black bar under Edit is gone.
- Fixed (v0.119.4): **Report a problem** opens again on web and desktop — the
  dialog was stuck behind the workspace chrome.
- Changed (v0.119.4): Origin’s Look preview is taller so banner, logo, and
  profile image aren’t clipped in that little strip.
- Fixed (v0.119.4): “The signal has a history now” keeps history and now on
  one line instead of wrapping awkwardly.
- Changed (v0.119.4): Origin’s Tempo Theme bed sits a little louder so it reads
  under the film without taking over.
- Changed (v0.119.4): invitation emails offer **Create your TEMPO account** or
  **Download TEMPO** (no Windows-only wording), since you can create the
  account in the desktop app too.
- Fixed (v0.119.4): if TEMPO Desktop is registered on your account, the web
  rail says **Open in desktop** instead of keeping you on Update when the
  stored version is a little behind.
- Fixed (v0.119.3): the web rail no longer keeps saying **Update TEMPO Desktop**
  after you’ve already updated — it prefers a desktop install that can open
  from the browser, and Update downloads the current public installer instead
  of the old 0.100.6 copy.
- Fixed (v0.119.2): Scene cards keep rounded corners while hovering — the lift
  no longer flashes square edges, and the hover rim stays clipped to the card.
- Fixed (v0.119.1): Board stage columns clip their glass blur to the rounded
  corners again — no more little square jaggies around the edges.
- Added (v0.119.0): Origin now has an optional **Look** step after direction —
  pick a color scheme, logo, profile image, and banner before the story
  appears. Continue or **Skip for now** both move on; picking a palette gently
  fades Origin’s accents into those colors. The quiet bed under Origin is now
  Tempo Theme.
- Under the hood (v0.119.0): run migration **084** in the Supabase SQL editor
  before relying on Origin look-step resume (`artist_origins.current_step`
  gains `'look'`).
- Fixed (v0.118.1): Origin’s story panels sit middle-left instead of the top
  corner, and The Story is wider with its own scroll so long chapters aren’t
  cut off.
- Changed (v0.118.0): Scene cards keep the frosted footer, but the banner
  now runs behind it to the bottom of the card — no hard cutoff between
  artwork and glass.
- Fixed (v0.118.0; Desktop v0.100.11): dictation on TEMPO Desktop shows your
  words in the field while you’re still talking — it no longer waits until you
  hit Stop to transcribe everything at once.
- Fixed (v0.118.0): Board track cards light the same cursor-edge glow as
  Tracks again — the column’s overflow clip had been killing that hover
  animation.
- Fixed (v0.118.0): Calendar month and day titles use Inter again, so years
  like 2026 no longer show Jura’s dotted zeros.
- Changed (v0.118.0): Today’s Needs attention list shows four tracks at a
  time (was five), so the cover strip peeks in below without scrolling.
- Fixed (v0.118.0; Desktop v0.100.11): the Windows Start / taskbar app icon
  is the equalizer mark again — the previous icon file was corrupted and
  could look like a broken cube instead of the light bars.
- Changed (v0.118.0): Spotify players sit in a darker, more rounded frame so
  light corners stop peeking around the embed. The Social globe sits a little
  higher, and Scene cards use a frosted glass footer for the title and member
  count.
- Changed (v0.118.0; Desktop v0.100.11): desktop message toasts are larger,
  use your artist Cool/Warm colours, and keep the Spectra side edge inside
  the rounded corners.
- Changed (v0.118.0): Board track cards no longer carry a permanent side
  line — hover still lights the Spectra edge the same way as Tracks.
- Changed (v0.118.0): the amber-to-ice side line is only on page heroes and
  Board columns now — not on every glass tile or every track card — and it
  stops short of rounded corners so it no longer sticks out past the curve.
- Fixed (v0.118.0): glass widgets across the app share one soft drop shadow
  instead of mixing a heavy panel shadow next to a nearly flat quiet tile —
  Today’s Needs attention / Tasks due pair (and the same pattern elsewhere)
  now sit at the same height.
- Fixed (v0.118.0; Desktop v0.100.11): when TEMPO Desktop is in the tray or
  behind other windows, a new message shows a glass toast in the bottom-right
  with the preview text and a soft chime — including on Windows 11, where the
  old popup could sit there invisibly.
- Added (v0.118.0): after you accept an invite and create your account, TEMPO
  asks whether you want to continue in the browser or download the Windows
  desktop app — your call before Origin starts.
- Changed (v0.118.0): major glass panels across the workspace pick up Origin’s
  thin amber-to-ice side edge, so the regular app shares that prism edge light.
- Fixed (v0.118.0): a long Origin story no longer runs off the bottom of the
  screen — The Story scrolls inside its panel, and Edit stays reachable.
- Fixed (v0.118.0; Desktop v0.100.11): dictation in Origin on TEMPO Desktop no
  longer dies with “stopped unexpectedly” at the start — desktop uses the same
  solid mic recording path as Messages instead of the browser speech shortcut
  that fails inside Electron.
- Fixed (v0.118.0; Desktop v0.100.11): the desktop tray / Start icon shows the
  TEMPO emblem instead of a blank slot, and opening TEMPO again focuses the
  window you already have instead of starting a second copy.
- Changed (v0.118.0): if Desktop is already on your account, Download for
  Windows becomes Open in desktop (or Update when the install is too old), on
  both the rail and the Download page.

- Changed (v0.117.0): everyday UI type sits a step larger — body copy, rail
  links, buttons, labels, and the dense meta text under cards and counts —
  so smaller lines are easier to read without changing the big titles.
- Fixed (v0.116.2): dotted zeros are cleared across the rest of the app —
  project stats, board counts, calendar figures, scene metrics, and other
  number runs now use the same clean numeral face as the Today counts.
- Changed (v0.116.1): Today’s banner lets more of the moving wash show
  through, and Spectra behind it stays a little sharper so it reads as lines
  again instead of smoke. Headers, rail links, and search sit a step heavier.
  The dotted zeros on homepage counts were Jura’s — those numbers are back on
  Inter so zeros stay clean.
- Changed (v0.116.0): the whole workspace now uses one typeface — Jura —
  including the rail, menus, body copy, and numbers. Hierarchy comes from
  weight (lighter wordmark, regular UI, medium titles and labels, heavier
  stats) instead of mixing families.
- Fixed (v0.115.1): the Today / Artist / Stats heroes show Spectra moving
  behind the glass again, without the stray bright line under the banner.
  Custom banner photos stay more translucent so the frost and light still
  read through.
- Changed (v0.115.0): search and the notification buttons sit a little lower
  under clearer top padding, stay clickable again, and sit closer to the page
  content. Thin shader lines under page titles and along the rail return while
  the soft video wash keeps running behind everything else. Custom banner
  photos on Today, Artist, and Stats keep a frosted glass feel instead of
  sealing the panel shut. The Social globe dissolves into the wash without a
  hard black frame around it, and type stays on the two-family system — Jura
  for titles, Inter for everything else.
- Fixed (v0.114.2): the populated Tracks catalog now sits inside the same
  darker glass depth as Calendar instead of placing its faint rows directly
  over the moving wash. Group colours, cursor lighting, and row interactions
  remain visible above the new surface.
- Changed (v0.114.1): the persistent workspace background is one restrained
  step darker, keeping its softened motion visible while letting content and
  glass surfaces hold the foreground more firmly.
- Changed (v0.114.0): Jura now gives titles and the TEMPO wordmark a lighter,
  more elongated geometric voice in the Eurostile vein. Primary page titles
  use a restrained medium weight and slightly more breathing room, while
  Inter remains the workhorse for controls, body copy, and data.
- Changed (v0.113.0): the softly moving background now stays mounted across
  the whole signed-in workspace, so changing pages does not restart it. The
  bright top-edge strip is gone, and the app's panels, quieter sections,
  dialogs, Board columns, and shader-backed feature areas now share the
  Calendar's translucent glass depth while retaining their own colour washes
  and animated accents. The background is also a tiny bit darker, and the
  legacy third font load has been removed so TEMPO's current two-font system
  resolves consistently.
- Changed (v0.112.2): the Calendar's moving background is a little clearer
  and brighter, while staying soft enough to sit behind dates and controls.
- Changed (v0.112.1): the Calendar's moving background is a touch brighter,
  and it now continues cleanly behind the global search controls instead of
  being covered by a dark rectangular strip.
- Fixed (v0.112.0): the Calendar's video background is actually visible now.
  As shipped it was effectively invisible — the clip's brightness sat in a
  small hot spot dead centre, hidden behind the calendar panels, while the
  parts of the page you could actually see held nothing but its near-black
  edges. The clip has been reworked into an even, lifted wash that reads
  across the whole page instead, and the darkening layer over it is back to
  the standard strength, so the dates are no less readable than before.
- Changed (v0.111.0): the Calendar's background is now a short blurred video
  loop instead of a generated animation — a soft cool wash that drifts behind
  the page. It is darkest down the left and along the bottom so the heading
  and the dates stay perfectly readable, and it holds still on a single frame
  if your system is set to reduce motion. The clip is 87KB, so it costs
  essentially nothing to load.
- Changed (v0.110.0): message controls now float beside each bubble instead of
  pushing received messages away from the left edge. Sent messages have more
  room before the new slim Spectra-coloured scrollbar, and the web app's
  microphone picker now lives under Settings > Account; TEMPO Desktop keeps
  the quick picker below the message box.
- Changed (v0.109.0): the Calendar's background is now slow concentric rings
  with soft rainbow edges, drifting outward about one ring every half minute.
  It was rebuilt to move smoothly at that speed: the previous versions either
  jumped on a repeating cycle or shimmered as their hairline-thin rings
  crawled between pixels, both of which read as stutter once the motion was
  slowed down. It also costs less to draw than what it replaced.
- Changed (v0.108.0): the Calendar's background is a different animated field
  again, and it now fills the whole page behind the calendar rather than just
  the box the calendar sits in — everything except the left menu and the thin
  colour strips at the top and bottom. It stays put as you scroll, pauses
  whenever the window isn't in front, and falls back to a still gradient if
  your system is set to reduce motion or your machine can't run it.
- Changed (v0.107.0): the Calendar has a new background — a slow "Waves" flow
  in deep sea-blue, teal, seafoam and sand. The app's usual light-field was
  too busy behind a grid of dates, so the Calendar now has its own calmer,
  slower one, dimmed well back so the dates stay the brightest thing on the
  page. It pauses whenever the window isn't in front, and falls back to a
  still gradient if your system is set to reduce motion or your machine can't
  run it.
- Fixed (v0.106.1): other artists' profile photos, banners and post images now
  actually appear when you're signed in. Before this, anyone but the person who
  uploaded an image saw the plain monogram placeholder instead — on artist
  profiles, in the Social feed, and anywhere an artist's mark is shown. Only
  imagery you're allowed to see is shown: private profiles and posts you can't
  view stay hidden.
- Fixed (v0.106.0): selecting an artist from **New message** now opens the
  returned conversation immediately. Existing archived conversations are
  restored for the sender instead of closing the picker into an empty panel.
- Changed (v0.105.0): Calendar now sits over TEMPO's live light-field shader
  with a soft legibility scrim, so its glass panels have real layered depth
  while dates and controls remain calm and readable.
- Fixed (v0.105.0): migrations 080 and 081 can now be safely rerun when their
  desktop policies already exist, allowing the messaging overhaul migration
  to deploy instead of stopping early.
- Fixed (v0.104.0; Desktop v0.100.10): **Open in desktop** now launches the
  installed TEMPO app instead of sending you back to its download page. The
  handoff keeps you on the same screen, and TEMPO Desktop now offers the
  matching **Open web app** action. The control has moved from the top toolbar
  to the left rail, directly above Settings.
- Fixed (v0.104.0): a rendering glitch above the Calendar's toolbar — a
  soft gradient wash meant to sit behind the glass toolbar was bleeding
  outside its own box, showing as a grainy streak under the page title.
  It's been removed; the toolbar now reads clean.
- Changed (v0.104.0): the Calendar's quick-add ("Studio session Friday at
  7pm") has moved from the bottom of the day panel to right below the page
  title, so it's the first thing you see. It's also smarter now — it asks
  TEMPO's assistant to read the sentence properly (so "next Tuesday," typos,
  and more natural phrasing all work), and falls back instantly to the
  simple parser if that's ever unavailable. You can also tap the microphone
  and just say it instead of typing.
- Added (v0.103.0; Desktop v0.100.9): Messages is now a focused, scrollable
  workspace instead of a page that grows forever. Artist and Scene chats load
  older history on demand, keep your place while you read, show new-message
  and typing signals without exposing read receipts, preserve drafts, and let
  you retry a send that failed.
- Added (v0.103.0): artist and Scene conversations now support replies,
  reactions, edits with an Edited mark, deleted-message placeholders, search,
  shared media, and shared pins. Inbox search, mute, mark unread, archive, file
  paste/drop, upload progress, and private support-message replies are part of
  the same calmer workflow.
- Added (v0.103.0; Desktop v0.100.9): the composer separates dictation from an
  actual voice note. Voice notes include duration, a compact waveform, and
  playback speed; desktop uses the system microphone by default, remembers an
  optional selected input, and now requests microphone permission correctly
  on Windows and macOS.
- Under the hood (v0.103.0): run migration 082 before deploying. It adds the
  protected message history, reactions, pins, search indexes, inbox state, and
  private realtime authorization used by the new messaging workspace.
- Changed (v0.102.0): the Calendar has been redesigned to feel calmer on
  first open. The old wall of buttons and chips is now a short toolbar plus
  a Filters menu and a "More" menu — everything that was there before
  (source filters, saved views, week numbers, categories, CSV/print export,
  multi-select) is still there, just one click deep instead of all at once.
  Clicking a day now opens a clean detail panel instead of jumping you into
  Agenda view, and that panel is where quick-add ("Studio session Friday at
  7pm"), the day's full list, and unscheduled items now live. Calendar
  surfaces also picked up a frosted-glass look in place of flat panels.
- Added (v0.102.0): a new Week view shows an actual hour-by-hour grid —
  drag an event to a new day or time, or click an empty hour to create one
  there. All-day items (task due dates, deadlines, releases) sit in their
  own row above the hours instead of being squeezed onto the clock.
- Added (v0.102.0): the Calendar now has an explicit display timezone
  (Calendar → More → Calendar settings), so every timed item shows
  converted to one consistent zone instead of each in whatever zone it was
  created in. Events scheduled in a different zone show a small globe mark.
  The event editor's timezone field is now a real picker with the UTC
  offset shown, plus quick duration buttons (30 min / 1h / 2h / 3h).
- Added (v0.101.0; Desktop v0.100.8): incoming messages and general
  notifications now have separate soft chimes. TEMPO Desktop stays active in
  the Windows tray after its window closes, keeps realtime delivery awake,
  shows native pop-ups while unfocused, and uses the real TEMPO icon in the
  hidden-icons panel. Clicking a pop-up restores the relevant conversation.
- Added (v0.101.0; Desktop v0.100.8): TEMPO Desktop now shows one calm update
  banner when a newer version is ready, with only **Update now** and **After
  this session**. The same prompt covers both product updates and installed-app
  updates without asking the artist to understand the difference, and TEMPO
  never interrupts a session or restarts itself automatically.
- Fixed (v0.100.12): joining a Scene from Discover or accepting a Scene invite
  now uses the signed-in account's Scene identity. The Owl's Nest Join button
  no longer fails on another account with a database conflict-constraint error.
- Fixed (v0.100.11): a new direct message now alerts you only above Messages.
  It no longer creates a duplicate item, unread count, or pop-up from the
  Notifications bell; catalog, social, calendar, and support notifications are
  unchanged.
- Changed (v0.100.10): web and downloadable TEMPO now have a written release
  contract: ordinary web updates automatically reach the desktop app, native
  desktop changes use their own release, and features that need both must keep
  working on older desktop installs while the update rolls out.
- Under the hood (Desktop v0.100.7): added a guarded Windows release workflow,
  a public binary-only update channel, automatic update checks at launch and
  every six hours, and a CI check that blocks mismatched desktop versions or an
  accidental return to the private source repository as the customer feed.
  The Download page can switch to the channel's stable latest-installer link
  through one Vercel setting while keeping the current beta as its fallback.
  The public `nikitapage10/tempo-desktop-releases` repository and scoped
  `DESKTOP_RELEASE_TOKEN` Actions secret must be created before the first run.

## 2026-08-10

- Fixed (v0.100.9): the Windows installer download now works even for
  someone with no TEMPO account at all — it was still being redirected to
  sign-in first.
- Fixed (v0.100.8): the Windows download link now actually works for
  everyone — the previous link only worked when signed into GitHub with
  access to the private source repo, which meant it silently 404'd for
  every artist except the account that built it.
- Added (v0.100.7): TEMPO Desktop for Windows is live — the Download page's
  "Download for Windows" button now links to a real, working installer
  instead of a disabled placeholder. It's an unsigned beta build, so
  Windows will show a SmartScreen warning first; the page explains how to
  get past it. A Mac build still isn't up (it has to be built on a Mac).
- Fixed (v0.100.6): the web app's "Download for Windows" link now correctly
  switches to "Open in desktop" once you have TEMPO Desktop installed and
  signed in — the desktop app wasn't actually registering itself with your
  account before now, so the button never knew it was already there.
- Fixed (v0.100.5): TEMPO Desktop's floating zoom control was sitting on top
  of the left-hand navigation instead of beside it — it now clears the rail.
- Fixed (v0.100.4): TEMPO Desktop's window could never actually be resized
  small enough to see the navigation switch to the phone-style layout — the
  minimum window size is much smaller now, so shrinking the window responds
  the way it does on the web.
- Changed (v0.100.3): TEMPO Desktop's zoom control moved out of the rail
  into a floating button in the bottom-left corner — mirroring the floating
  assistant button on the bottom-right — so it's reachable from anywhere,
  not tucked into a menu.
- Fixed (v0.100.2): TEMPO Desktop's window can now actually be dragged from
  anywhere along the empty space at the top — not just a narrow band in the
  middle of a wide window. The zoom control also moved out of the top bar
  down to the rail's bottom corner, next to the version number.
- Fixed (v0.100.1): TEMPO Desktop's window finally looks and feels like a
  real app instead of a browser window: no more File/Edit/View menu bar
  on Windows, the minimize/maximize/close buttons are recolored to match
  TEMPO's own dark palette instead of stock white, the empty space along the
  top can be dragged to move the window, it opens generously large without
  filling the whole screen, and a small zoom control (next to where the
  download link would be on the web) sits on every screen — Ctrl+ / Ctrl-
  / Ctrl+0 also work. Also fixes a packaging bug where the desktop app
  couldn't start at all.
- Fixed (v0.100.0): the TEMPO Desktop download page now uses the same
  full-width workspace gutters as Settings, Social, and Projects.

- Fixed (v0.100.0): Settings now uses the same full-width page gutters as
  Social, Projects, and the rest of the workspace, aligning its title and
  content with the global Download button and search bar.

- Changed (v0.100.0): bounce history no longer has a limit. Every version
  you upload to a track now stays in its timeline for good — nothing is
  auto-deleted. What changed instead: cloud storage itself now keeps only
  the current bounce and the one before it; an older one only ever leaves
  the cloud once a copy of it is confirmed safe on a desktop computer, so
  nothing is ever lost if you don't have TEMPO Desktop installed. Each
  version now shows where it currently lives (on this computer, in the
  cloud, or on another of your computers). Unpinning a version is instant
  now — pinning is purely for highlighting a milestone in the timeline; it
  no longer has any bearing on what's kept.
  Under the hood: run migration 081 in the Supabase SQL editor. It adds the
  columns and the `version_local_copies` table this depends on.
- Added (v0.99.0): the first piece of TEMPO Desktop — a downloadable
  Windows/Mac app that's coming, not live yet. A quiet "Download for Windows"
  or "Download for Mac" link now sits at the top-left of every screen (next
  to Notifications and Messages), leading to a new Download page that
  explains what the desktop app will add: instant loading from your own
  computer, your complete bounce history kept locally instead of just the
  newest two, working on Board, Tracks, Projects, Tasks, and Calendar with no
  internet connection, and syncing quietly in the background so it's already
  caught up when you open it. The button and page are ready ahead of the
  actual installers, which aren't published yet.
  Under the hood: run migration 080 in the Supabase SQL editor — it adds a
  `user_devices` table that lets the web app know when your account has the
  desktop app installed, so the button can switch to "Open in desktop."
- Fixed (v0.99.0): the app version shown under Settings in the rail had
  drifted out of sync with the actual release number; the two now match again.
- Fixed (v0.98.2): Discover still expands the people shown on the Social globe,
  but switching among Top 8, Follows, and Discover now preserves the globe's
  orientation; the extra “Recently active around TEMPO” heading was removed.

- Improved (v0.98.2): Board focus mode now navigates exclusively through the
  minimized stage rails, removes the redundant stage-count/Previous/Next bar,
  and uses a longer fade-and-resize handoff to eliminate abrupt card reflow.
- Fixed (v0.98.2): Nikita's automated onboarding welcomes now stay out of her
  artist Inbox and Archived lists until the new member replies; existing
  unanswered welcome-only threads are hidden as part of the migration.
- Improved (v0.98.2): the Social post composer now shows a full image preview
  before publishing, with the same widescreen crop used in the feed plus clear
  Replace and Remove controls.
- Fixed (v0.98.2): artists can now delete their own Social posts from either
  the feed or post detail after confirmation; removal is immediate, rolls back
  on failure, and no longer treats a rejected zero-row update as success.
- Improved (v0.98.2): Calendar items now carry a faint background wash from
  their selected category color in addition to the stronger colored edge,
  icon, and label treatment across month, agenda, and timeline views.
- Improved (v0.98.2): opening a minimized Board stage now shifts the focused
  three-stage window only as far as needed and smoothly collapses the outgoing
  column while expanding the selected one.
- Improved (v0.98.2): Signal 1 now prefills “Artist Name” instead of “My
  Artist” for new accounts and upgrades that legacy placeholder for unfinished
  Origin sessions without changing real artist names.
- Fixed (v0.98.2): the Social globe now keeps its WebGL edge outside the
  visible circular crop, preventing the intermittent black rim that appeared
  as the Earth rotated or was zoomed.
- Fixed (v0.98.2): PRESIDENT demo workspaces can no longer emit follow or any
  other social notification. Demo follow edges are discarded instead of being
  transferred to a real profile, and stale PRESIDENT notices without a live
  matching follow are removed while legitimate real-account follows remain.
- Improved (v0.98.2): Discover now has its own broader globe and artist list,
  ranked by recent visible activity and profile updates. It can surface both
  followed and new-to-you artists, while Top 8 and Follows keep their existing
  globe behavior; demo and private profiles remain outside real discovery.
- Fixed (v0.98.2): joining the member network now remains successful even if
  Green Room reconciliation needs a retry, and the repaired Scene migration is
  live. Private new accounts no longer receive or display a pre-populated
  starter feed; Green Room membership begins only after they opt in.
- Fixed (v0.98.2): Signal 1 in Origin now displays an artist name with the
  exact lowercase and uppercase characters entered instead of visually forcing
  every name into capitals.
- Fixed (v0.98.2): migration 060 can now resume after a partial application.
  Its Scene membership backfill no longer calls an older chat-participant
  trigger with a conflict key that the first attempt already replaced.
- Improved (v0.98.2): Board now keeps three detailed stages open at a time and
  minimizes the rest into clickable, droppable rails. A separate See all mode
  fits the entire pipeline on screen as a compact overview of titles, momentum,
  notes, and attention counts without forcing horizontal scrolling.
- Improved (v0.98.2): the PRESIDENT demo now uses the supplied official
  wordmark as its artist logo. Existing demos are offered the refreshed sample
  revision so the new identity artwork appears there too.
- Fixed (v0.98.2): PRESIDENT and future demo artists are now isolated from the
  live social graph. Opening a demo can no longer make it follow the inviting
  account, join the member network, or send a follow notification. Migration
  076 removes accidental demo notifications and moves any valid inviter
  connection to the member’s real artist identity.
- Improved (v0.98.2): leaving the main workspace introduction now asks whether
  to skip only that tour or every remaining page tour. Today shows at most five
  Needs attention items until expanded, and a full Board keeps every populated
  stage readable in a horizontal pipeline instead of squeezing cards into thin
  columns.
- Added (v0.98.2): Calendar now has a distinct default color for every TEMPO
  date and event type. A Categories panel lets members rename or recolor those
  categories and add their own event categories. The defaults work without a
  database change; saving custom categories requires migration 075.
- Improved (v0.98.2): the PRESIDENT demo uses the Blood Of Your Empire artwork
  as its banner, has a longer three-paragraph About section, adds more artists
  to a continuously moving Social globe, and includes a mix of funny and
  serious fictional sample conversations. Scenes now opens a full read-only
  demo room, “It’s Not Just a Phase,” rather than treating PRESIDENT as off the
  network.
- Improved (v0.98.1): the PRESIDENT demo now arrives with its supplied profile
  portrait and live banner, Spotify cover art on linked releases, a run of
  shows and production holds in Calendar, and separate social, live-production,
  and merch projects with their own tasks. Social no longer leaks whichever
  test or member profiles happen to be in the database; it uses a clearly
  labelled, shared preview with recognisable rock artists instead. The demo's
  photos and catalog artwork are shared references rather than duplicate files
  copied into every member's private storage.
- Improved (v0.98.1): opening the demo now offers the workspace tour even if
  you've toured your own artist already. Removing the demo defaults to not
  repeating those tours on your real workspace, with a checkbox if you want to
  see them again. Older PRESIDENT demos show an Update demo data action so the
  richer sample can be rebuilt in place.
- Fixed (v0.98.1): joining the member network now reconciles Green Room
  membership as part of the same action, instead of relying on a first-run job
  that may have finished too early. The released-music panel on artist profiles
  also uses one compact picker rather than a tall stack of track buttons.
- Fixed (v0.98.0): every screen in TEMPO now opens faster. Some first-run
  setup — building the small starter community you land in, and looking up
  your artist list — was quietly being redone from scratch every single time
  you opened any page, long after it was finished. It now runs once and stays
  done, and a couple of lookups the app was making twice per page now happen
  once. Nothing looks different; there's just less waiting before a screen
  fills in.
  Under the hood: run migration 074 in Supabase before this works.
- Added (v0.98.0): you can now look around a demo workspace instead of
  bringing your own music in first. Wherever TEMPO offers to import your
  catalog — inside the opening story, and on the Import screen — there's
  now an "Explore a demo artist" option. It loads a sample catalog built
  around PRESIDENT, the masked band whose debut album lands in September:
  their songs sitting at different stages on the board, the album and EP
  as projects, launch tasks with real deadlines, a few weeks of logged
  studio sessions, guest feedback waiting to be answered, and a filled-in
  artist page. It's enough to see what every screen looks like with a
  real record in progress behind it.
  The released songs actually play. TEMPO connects each one to its real
  recording and the built-in Spotify player handles it, so ten of the
  demo's tracks are audible straight away; the unfinished ones stay
  silent, exactly as they would in real life.
  Alongside the real catalog there are six made-up songs in the early
  stages — sketches, half-written things, one stuck in a second verse —
  under a project called "Record two (working)". They're there because a
  released discography has nothing sitting in Idea, Writing or Production,
  and that's the half of the board a new artist most needs to see working.
  The demo arrives as its own artist alongside yours, so none of it mixes
  into your own catalog, and a strip across the top says so on every
  screen while you're in it. "Remove demo data" takes the whole thing
  away in one click — and if you were partway through setting your own
  artist up when you started looking, you pick straight back up where you
  left off. Nothing you'd entered is lost.
  Song titles, release dates, track order and running times come from
  PRESIDENT's actual discography, read back from their live catalog rather
  than typed from memory. The things TEMPO stores that aren't public —
  BPMs, keys, session notes, feedback — are made up so those parts of the
  app have something to show, as are the six early-stage songs.
  Under the hood: run migration 073 in Supabase before this works.
- Added (v0.97.0): a quiet guide on Today, "Your TEMPO loop," suggests one
  next step for artists just getting going — bring in a song, name the
  next move, focus on it, upload a bounce, get feedback, close the loop.
  It only ever recommends one thing at a time, explains why, and never
  turns into a forced tour or a score. "Not now" snoozes it for a week;
  "Hide this guide" turns it off until you turn it back on. Existing
  artists see a small one-line invitation instead of the full guide.
- Added (v0.97.0): TEMPO Pulse — an optional briefing instead of a stream
  of separate notifications. A small "what changed while you were away"
  card can appear on Today, and Settings → Notifications now has a Pulse
  section where you can turn on a daily or weekly email summary, pick a
  delivery time and timezone, choose which categories it covers, and
  decide whether it uses generic wording or actual track/project names.
  Pulse email is off until you turn it on, is easy to pause or
  unsubscribe from with one click, and never includes the body of a
  message, comment, or note.
- Added (v0.97.0): a small, private "product improvement data" explanation
  in Settings → Account describes the limited, anonymous usage events
  TEMPO now records (like "a track was created") and states plainly what
  they never include — titles, lyrics, notes, messages, or anything you
  wrote.
- Added (v0.97.0): the private Admin console's usage analytics page gained
  an aggregate-only Activation & Pulse section (signup-to-first-song
  progress, return rates, guide and Pulse engagement) — still no
  per-member activity view, ever.
- Under the hood: this release adds four new database tables behind the
  scenes (usage-pattern tracking, guide preferences, notification
  preferences, and the Pulse email queue) plus a migration recording which
  database updates have been applied. None of them touch your tracks,
  files, or any existing data. These migrations still need to be run in
  Supabase before this release is deployed — see migrations 068 through
  071.
- Under the hood: this release also adds an automated test setup (a
  separate, isolated test database — never your real one — plus automatic
  checks that run before changes ship) so future changes can be verified
  without any risk to your real catalog.

## 2026-08-09 (3)

- Fixed (v0.96.0): the Today page's scrolling cover art no longer glitches
  and races out of control for artists with very large catalogs — it now
  shows a fresh sample of up to 30 tracks each time you open the page
  instead of trying to scroll every track at once.
- Changed (v0.96.0): the Board now shows up to 30 tracks per stage by
  default, with a "Show more" button to reveal the rest — huge catalogs no
  longer flood a single stage column.
- Changed (v0.96.0): when importing a large Spotify catalog, only your 100
  most recently released tracks now get cover art and a Spotify link copied
  in automatically. Every imported track still gets its title, type, and
  album info — this just keeps very large imports (hundreds of tracks) fast
  and reliable instead of bogging down on photo and link fetching for
  everything at once.

## 2026-08-09 (2)

- Fixed (v0.95.2): the Notifications and Messages popups no longer appear
  partly off the left edge of the screen on a phone.
- Added (v0.95.2): the bottom navigation on a phone now has a More button
  that opens Tracks, Projects, Artist, Social, Scenes, Stats, and Settings —
  previously those pages had no way to be reached from a phone at all.

## 2026-08-09

- Fixed (v0.95.1): the Scene network (My Scenes, Discover, Scene Studio) now
  has a bottom navigation bar on phones — previously there was no way to move
  between those sections on a small screen.
- Fixed (v0.95.1): Messages, and the private support inbox in the admin
  portal, now show either your conversation list or the open conversation on
  a phone, not both stacked on top of each other. Opening a message now gives
  it the full screen with a Back button, instead of burying it below a long
  list.

## 2026-08-08

- Added (v0.95.0): TEMPO now asks every member to explicitly accept the
  current Terms and Privacy policy before entering the private app, and records
  the policy version and time they agreed. New members accept while creating
  their account; existing and provider-sign-in members get one clear agreement
  screen.
- Added (v0.95.0): the legal policies now clearly protect TEMPO from copying,
  reverse engineering, resale, scraping, and use of private product access to
  build a competing service, while confirming that artists keep ownership of
  their music.
- Changed (v0.95.0): Privacy now says plainly that private tracks, audio,
  lyrics, notes, files, and messages are stored to run TEMPO but are not
  routinely browsed through the admin portal, sold, used for ads, or used to
  train AI models. The same promise is visible in Account settings.
- Fixed (v0.94.1): the independent Scene network is now clearly linked from
  the existing Scenes page, and Scene Studio offers the Owl's Nest installer
  before you own a Scene. The populated demo is no longer hidden inside an
  existing Scene's management screen.
- Added (v0.94.0): Scenes can now operate as full independent networks, with
  their own `/scene` home and Scene Studio, while remaining available inside
  each artist's TEMPO workspace.
- Added (v0.94.0): owners can build a Scene from configurable discussion,
  chat, event, library, showcase, and page sections; create private member
  groups; see a network-health overview; and publish selected parts as a
  public front door.
- Added (v0.94.0): Scene membership now has an account-level identity, so a
  collective, writing room, school, or community no longer depends on an
  artist profile. Chats and sections understand those member identities.
- Added (v0.94.0): Scene Studio can install a populated Owl's Nest demo with
  realistic posts, live chat, a listening-room event, resources, a welcome
  page, member showcase, badges, and available test accounts as members.
- Changed (v0.94.0): Scene banners now have a generous responsive canvas,
  editable focal point, persistent palette lighting, subtle texture, and a
  deliberate identity block. Emblems no longer sit halfway between the
  banner and the member row, and discovery cards use the same visual system.
  Under the hood: run migrations 060 through 067 in order before deploying.
- Fixed (v0.93.2): the Manage/Leave scene buttons on a scene page were
  rendering with their top edge flattened, like something was cut off. They
  were sharing a row with the avatar that intentionally overlaps the banner,
  which put the buttons' own top edge inside the banner too. Buttons now sit
  in their own row, fully clear of the banner.
- Fixed (v0.93.1): a deleted scene's name/address stayed locked forever, so
  trying to start a new scene with the same name said "That address is
  taken." Deleting a scene now frees its name for reuse.
  Under the hood: needs migration 058 run.
- Fixed (v0.93.1): a new scene's banner had a bright glow sitting directly
  behind the Manage/Leave scene buttons, making them look cut off. The
  banner's color highlights now stay clear of that corner.
- Added (v0.93.0): a scene's owner can now edit it after creation — name,
  tagline, about text, banner, emblem, door, who can find it, and color — and
  can delete the scene from a new Settings page on the Manage dashboard.
  Deleting removes it from search and browse for everyone but keeps its
  members' and posts' history rather than erasing it.
- Fixed (v0.93.0): a scene's feed was rendering squeezed into a narrow sliver
  of the page instead of using the full width, for any scene without more
  than one topic (which is every scene until an owner adds one).
- Fixed (v0.92.0): a scene you just created now correctly shows you as a
  member instead of "0 members."
- Changed (v0.92.0): a new scene's page feels less bare — the banner has more
  visual depth instead of a flat block of color, the post box no longer looks
  greyed-out/disabled while empty, and an empty feed now invites you to post
  instead of showing a plain line of text.
- Fixed (v0.91.3): creating a scene works. The permission rule that decides
  who can see a scene was checking the scene's membership by looking the
  scene up — which fails for a scene that is still in the middle of being
  created, so every new scene was rejected at the moment it was made. The
  owner is now recognised directly.
  Under the hood: needs migration 057 run.
- Fixed (v0.91.2): the three "door" choices when starting a scene (Open, Ask
  to join, Invite only) now clearly show which one is picked — they were
  always clickable, but the selected one looked identical to the others, so
  the whole row read as greyed out. Also another attempt at the scene
  creation failure: the app now states who owns the scene explicitly instead
  of leaving it for the database to infer.
- Fixed (v0.91.1): the workspace tour reliably starts after first-time Origin
  for each artist. A prior tour on the same browser no longer suppresses a new
  artist's introduction, and **Replay introduction** now deliberately replays
  the tour as well as the film so the complete handoff can be experienced again.

## 2026-08-07

- Fixed (v0.91.0): creating a scene was failing outright with "Couldn't
  create that scene." — a database permission was missing its "you can create
  a scene you own" rule. Also fixed: errors from Scenes now show what
  actually went wrong instead of a generic message, which is what made this
  one hard to diagnose in the first place.
  Under the hood: needs migration 055 run, after 049–054.
- Added (v0.91.0): a scene now has a welcome checklist for new members, a
  moderation history managers can review (pins, removals, bans, role
  changes, approvals), and shows up in global search. Scene notifications
  (join requests, approvals, invites, announcements, events) now sort into
  the Social filter in your notification tray.
- Fixed (v0.90.1): the first-workspace tour now waits for the complete Origin
  arrival animation before appearing, instead of interrupting the cinematic
  handoff shortly after the dashboard begins to show.
- Added (v0.90.0): Scenes now has a Chat tab — a group thread for everyone
  in the scene. It works the same as any TEMPO message: text now, with
  images and files to follow. Leaving a scene takes you out of its chat too.

- Added (v0.89.0): Scenes now has events. A manager can add one with a date,
  a kind, a location or link, an optional headcount limit, and details;
  members RSVP going, interested, or can't go, and see how many others are
  coming. A full event stops taking new "going" RSVPs. A manager can cancel
  an event, which pulls it for everyone.
- Added (v0.88.0): Scenes can now hold polls and open questions. Ask a
  multiple-choice question with up to ten answers (single- or multi-select),
  and watch the results fill in live once someone's voted or the poll has
  closed. Open questions skip the options entirely — answers just come in as
  comments. A manager can close a poll early.
- Added (v0.87.0): Scenes now has a real feed. Post to a scene, pin something
  to the top, split posts into topics when a scene has more than one, and
  post an announcement if you manage the scene. Likes and comments work the
  same way they do everywhere else in TEMPO. Managers can remove a post,
  which takes it out of the feed for everyone and is recorded so it can be
  explained later.
- Added (v0.86.0): finishing Origin now opens an optional one-minute workspace
  tour after the cinematic handoff. It spotlights Today, quick actions,
  navigation, search, and the assistant in TEMPO's signal language, works on
  desktop and phone, and can be skipped before or during the tour.
- Changed (v0.86.0): the opening chapter of Origin's scrolling reveal now has
  a larger animated **Scroll to reveal your story** prompt, a phone-specific
  swipe cue, the number of chapters ahead, and a tap action that advances to
  the next chapter.
- Added (v0.86.0): the first pieces of **Scenes** — a new kind of room for
  the people you make music with, separate from your own catalog. A Scene
  can be a label roster, a school cohort, a crew, or any group you're part
  of. You can start one, set whether people join freely, have to ask, or
  need an invite, and see who's in it. A scene has its own owner and
  moderators, who can review requests to join. The feed, polls, events, and
  chat that will live inside a scene are still on the way — this first pass
  is the room itself and who's allowed in it.
  Under the hood: this needs six new database updates, migrations 049
  through 054, run in order in the Supabase SQL editor before Scenes will
  work. Until they're run, the new Scenes tab explains that a database
  update is needed rather than showing an error.

- Fixed (v0.84.5): unfinished first-time Origin onboarding now blocks the
  workspace shell entirely. Returning artists resume at their last saved
  section, with an immediate same-browser safety copy protecting changes made
  just before a tab closes while cloud autosave remains authoritative.
- Changed (v0.84.4): Origin's history and direction questions now share one
  simple dictation control. Tap the microphone to start, tap it again to stop,
  or pause for a few seconds to stop automatically. Direction 02 also uses a
  darker glass surface and stronger text contrast over bright film frames.
- Changed (v0.84.3): Today’s moving cover rows are now playable. Hovering a row
  slows it down substantially; the center of each cover plays or pauses its
  current bounce, while a black-gradient title and artist strip opens the track
  page. The controls remain visible on touch screens.
- Fixed (v0.84.2): the rail media player's Previous and Next controls now use
  every playable track in the active space. The queue refreshes on the homepage
  and when bounces are uploaded, removed, or made current, instead of remaining
  a stale snapshot of the last Tracks-page view.
- Added (v0.84.1): individual track pages now have compact Previous and Next
  controls in the header. They follow the current space's track order, making
  it possible to move through the catalog without returning to Board or Tracks.
- Changed (v0.84.0): Origin now asks one useful direction question after the
  artist shares their history. The separate recap screen is gone; the scrolling
  reveal is the single place where Origin reflects the story back and lets the
  artist edit it.
- Added (v0.84.0): every interactive Origin section has a small Back control.
  Moving backward keeps the name, history, direction, and edited profile copy
  intact.
- Changed (v0.84.0): Origin generates clearly separated profile material for
  About, The sound, Right now, and a modular public story. Story chapters can be
  added, edited, removed, and reordered during Origin or later in the profile
  editor.
- Changed (v0.84.0): artist profiles now lead with featured music, integrate
  genres and roles into About, give links their own Listen and connect section,
  and present the longer story as artist-owned chapters instead of one folded
  block. The generic Details card has been removed.
- Under the hood (v0.84.0): run
  `migrations/048_origin_direction_and_profile_story.sql` in Supabase after
  migration 047 before using the new Origin flow.
- Changed (v0.83.0): Origin now follows one grounded signal from its first faint
  appearance through a name, a history, refraction, and a direction. The same
  screens and six-part story remain, with clearer language and no early product
  introduction before the final **Enter TEMPO** threshold.
- Added (v0.83.0): the supplied ambient focus track begins only when the artist
  presses **Tune in**, plays quietly on a continuous loop throughout Origin,
  and fades away as the workspace opens.
- Changed (v0.82.0): Origin is now **Coming Into Focus**. Its story follows a
  flicker into a signal, focus, spectrum, and present direction, asking what
  keeps bringing an artist back instead of trying to declare who they are.
- Changed (v0.82.0): the reflection at the end of Origin is more useful and
  grounded: a public-ready introduction, the spark and pull behind the work,
  specific sound markers, and where the artist's energy is pointing now.
- Added (v0.82.0): artist profiles can show featured music, a living **Right
  now** direction, and a visual **Spectrum** of the sounds and contrasts that
  keep returning. The longer story stays available without dominating the
  page, and sharing controls now sit compactly in the profile header.
- Under the hood (v0.82.0): run `migrations/047_living_artist_profiles.sql` in
  Supabase before deploying this version.

## 2026-08-02

- Fixed (v0.81.1): Continue with Microsoft now asks Microsoft for your email
  during sign-in, which Supabase needs to finish the account. (You still need
  the email permission turned on in the Azure app — see the OAuth setup guide.)
- Fixed (v0.81.0): the same silent-transparency bug from v0.80.0 also affected
  every ice/amber/violet/green/coral tint with a strength modifier — over 300
  classes app-wide, including the very color tint just added to Tracks groups
  in v0.80.0, which is why picking one appeared to do nothing.
- Changed (v0.81.0): Origin's panels are glass again — a soft, blurred tint
  over the film rather than a flat card. The "Listening back to the shape of
  it" moment during processing no longer sits on a background at all.
- Fixed (v0.81.0): "Good. I can see you now." had almost no time on screen —
  its reveal was quietly running from the moment the panel mounted, not from
  when it actually became visible, so most of its short window burned away
  unseen. It now starts its clock on the first visible frame instead.
- Fixed (v0.81.0): Enter TEMPO's arrival film could still be cut short. A
  second, independent redirect could fire mid-completion using a stale "is
  Import still owed" flag from when the page first loaded — sending the
  artist to the wrong screen and then, a moment later, colliding with the
  intended one, aborting the reveal. That redirect now only ever acts on
  arrival, never mid-flow.
- Added (v0.81.0): a custom color option for track groups, alongside the fixed
  palette — pick any color rather than one of the five presets. Needs
  migrations/045_track_group_custom_color.sql in Supabase.
- Removed (v0.80.1): Continue with Apple is no longer on the sign-in screen —
  Google and Microsoft remain.
- Fixed (v0.80.0): translucent surfaces across the whole app were painting
  nothing at all — panels, menus and toolbars were see-through and held up only
  by their blur and borders. They now have the fills they were always meant to.
  This is why Origin's panels looked washed out with the film reading through
  the words; it was never really about the fade.
- Added (v0.80.0): groups on Tracks can carry a cover image and a colour. The
  cover shows as a thumbnail beside the name, and the colour tints the group so
  an EP reads as one block instead of another anonymous list. Both are optional
  — a group with neither looks exactly as it did.
- Changed (v0.80.0): tracks that aren't in a group now sit at the top of the
  list by default, above the groups. You can still move any group above them.
- Fixed (v0.80.0): Origin could open on a black screen and never start, and its
  films sometimes never began downloading, leaving it stuck on "One moment…".
- Under the hood (v0.80.0): run `migrations/044_track_group_identity.sql` in
  Supabase before using group covers or colours. Until you do, Tracks works
  exactly as before and says so if you try to reorder.

- Added (v0.79.0): Forgot password on the sign-in screen — TEMPO emails a reset
  link, then you choose a new password. Also added public Terms of use and
  Privacy policy pages, linked from sign-in, create-account, and Account
  settings.
- Under the hood (v0.79.0): step-by-step Google / Microsoft / Apple setup lives
  in the OAuth setup guide; allow the production `/auth/callback` URL in
  Supabase for both social sign-in and password reset.
- Added (v0.78.0): Settings → Notifications is a full activity inbox — filter by
  catalog, social, messages, calendar, or support, mark all read, dismiss
  individual items, and jump into the related place. The bell still shows recent
  ones and links to View all.
- Added (v0.78.0): Settings → Account covers email, password, sign-out, links to
  profile visibility and DM settings on Artist, help, and a typed-confirm
  delete-account path.
- Changed (v0.77.1): Settings Studio / Catalog / Account are real tabs now —
  each one shows only that section instead of scrolling the whole page.
- Changed (v0.77.0): Settings is no longer one long stack of identical boxes.
  It opens with the shared page header, a jump nav for Studio / Catalog /
  Account, and grouped sections with clearer hierarchy.
- Changed (v0.76.1): the Admin console no longer lets you download a member’s
  catalog JSON. You only see backup status (when snapshots ran, sizes, counts)
  and can save a fresh snapshot without opening their songs or notes. Members
  still export and restore from Settings → Your data.

- Added (v0.76.0): Settings → Your data lets you export your catalog metadata
  (tracks, notes, projects, tasks, calendar, and related text), restore from a
  file, save a snapshot now, and merge back from automatic snapshots. Audio
  bounces are not included — keep those in your own archives.
- Added (v0.76.0): Import recognizes a TEMPO catalog export and offers a direct
  merge restore instead of treating it like a random spreadsheet. Messy or older
  JSON can still be reshaped with the same AI used for Import.
- Added (v0.76.0): TEMPO takes nightly metadata snapshots for every account so
  you have a short time machine of the text side of the catalog. The Admin
  console only sees backup status, not the contents — members export and restore
  from Settings → Your data.
- Under the hood (v0.76.0): set `CRON_SECRET` in Vercel for the nightly job; see
  the backup runbook. Confirm Supabase Pro daily database backups are on.

- Fixed (v0.75.0): the intro copy now sits on the film's centre line. The whole
  picture is nudged once against the text rather than per scene, and the opening
  lines no longer drift up or down depending on how many of them there are.
- Changed (v0.75.0): panels now arrive quickly on an already-solid surface and
  rise slightly into place, instead of spending a long moment half-transparent
  with the film reading through the words.
- Fixed (v0.75.0): the story chapters no longer pile up. Each one owns its own
  stretch of the scroll and hands over across a short crossfade, and opening
  Bring your music in now clears every other chapter off the screen instead of
  leaving them underneath it.
- Fixed (v0.75.0): Enter TEMPO plays its arrival film again. The handoff was
  being claimed too late, so the app could open before the film knew to run.
- Fixed (v0.75.0): Origin's videos should behave on Safari. Clips were being
  warmed up in a way Safari refuses to download, and too many were held open at
  once for it to cope with — please let me know how it looks on your Mac now.
- Added (v0.75.0): groups on the Tracks page can be dragged into a new order by
  the handle beside their name, as well as moved with the arrows.
- Changed (v0.75.0): tracks that aren't in a group no longer sit under an
  "Ungrouped" heading — only real groups are named now.

## 2026-07-31

- Fixed (v0.74.1): the chapter-opening film now begins dissolving into its true
  final still before playback ends, then lets the scroll film rise above it over
  a longer fade. This removes the remaining flash and stop-start seam.
- Changed (v0.74.1): every audible Origin transition now starts its sound tail
  earlier, the opening copy aligns to the film's central light, and review copy
  uses higher contrast over bright frames.
- Changed (v0.74.1): later story chapters now carry the numbered light rails,
  layered glass, ambient geometry and richer content treatments introduced by
  The First Shape. Entering TEMPO now uses a persistent aperture-and-horizon
  reveal instead of the disappearing slit animation.

- Changed (v0.74.0): Origin now carries one continuous colour grade from its
  opening invitation into the first film, and its name and backstory moments
  use distinctive editorial glass compositions instead of standard form cards.
- Changed (v0.74.0): the speaking invitation asks plainly for the artist's
  origin, recurring pull, current work and intended feeling; processing holds
  long enough to register, while review is now a short calibration before the
  full story unfolds.
- Fixed (v0.74.0): the chapter transition holds an exported copy of its true
  final frame, preventing browsers from flashing the video's first frame at
  the seam. The first story chapter has a richer lit composition, and TEMPO's
  dashboard stays covered until the final arrival is ready to crossfade.

- Fixed (v0.73.2): the name acknowledgement now leaves completely before the
  speaking panel arrives, removing the remaining overlap between those scenes.
- Changed (v0.73.2): the speaking prompts now move more quickly and melt from
  one suggestion into the next instead of changing as a slow marquee.
- Fixed (v0.73.2): the final transition and scrolling film now meet on their
  matching frame without a long frozen hold, and story copy is back on a
  readable translucent glass surface instead of a flat black card.
- Fixed (v0.73.2): opening Bring your music in now locks that chapter at full
  clarity immediately; only the Import content itself scrolls while it is open.

- Fixed (v0.73.1): the “Who are you?” panel now waits until the opening line
  has completely faded, so the two moments never sit on top of each other.
- Fixed (v0.73.1): Origin’s soundtrack now eases fully to silence before a clip
  ends, pauses or is released, removing the audible crackle at scene changes.
- Changed (v0.73.1): TEMPO’s melting text voice now carries through the name
  acknowledgement, the invitation to speak and the processing moment instead
  of appearing only at the very beginning.

- Changed (v0.73.0): Origin now lets every panel arrive slowly and leave
  gracefully instead of popping on and vanishing. The opening copy stays on one
  line, the name panel holds still, the artist's name gets a readable
  acknowledgement, and the processing message fades in with the rest.
- Fixed (v0.73.0): a quick AI answer can no longer skip the processing scene.
  Its film now completes a full loop before the story resolves.
- Fixed (v0.73.0): the review panel now hints that there is more below without
  bringing back its scrollbar, story panels stay solid and legible over the
  brightest film frames, and the final transition decodes the scrolling film's
  first frame before blending into it.
- Changed (v0.73.0): bringing music in is now built into the scrolling Origin
  story. Intake, reading, review and final approval become chapters over the
  film; starting empty remains available, and nothing reaches the catalog until
  the artist approves the final plan.
- Changed (v0.73.0): entering TEMPO now resolves the film's actual final frame
  into the app through a brief Spectra light sequence. The workspace is
  interactive underneath immediately, and reduced-motion users get a direct
  handoff.

- Fixed (v0.72.0): Origin was skipping its transition films. Each panel and each
  scene change was being timed against the *previous* clip, and because that's
  usually a loop, the next step fired almost immediately. Transitions now play
  in full, and the panels fade in over them as intended.
- Fixed (v0.72.0): headings could overlap the text underneath them when they ran
  to two lines.
- Changed (v0.72.0): bigger type in the opening and throughout, the name and
  speaking panels read left-aligned, and the opening darkens fully to black
  before the film comes up.
- Changed (v0.72.0): every video is now warmed while the opening text is on
  screen, so nothing waits on the network once things start.
- Changed (v0.72.0): the story chapters move slower and grow as they come toward
  you, sit on a darker panel so they're actually readable against the film, and
  the opening one fades in. The closing chapter can no longer be scrolled past
  and lost — "Enter TEMPO" stays put.
- Fixed (v0.72.0): the scrollbar on the review step is gone, and the handoff
  into the scrolling chapter is a slower blend instead of a glitch.

- Fixed (v0.71.3): the name box, the speaking panel and the review step were
  rendering *behind* the film, so Origin looked like it had stopped working
  after the opening. They now sit above it, where they belong.
- Changed (v0.71.3): the opening line arrives sooner, and stays on screen as
  long as the lines that follow it instead of being hurried off.

- Fixed (v0.71.2): the opening text never appeared, which left Origin stuck on
  a still frame with nothing to click and no way to reach the name box. The
  text effect could stop the words rendering entirely; it can no longer take
  the text down with it.
- Changed (v0.71.2): Origin now opens on a held, silent frame for a moment
  before the first line arrives, rather than speaking the instant it loads.
  When you tap, the words clear first and the film comes up slowly out of the
  still — light arriving, rather than a video starting.

- Fixed (v0.71.1): the morphing text wasn't morphing — each line dissolved
  away before the next formed, instead of one becoming the other. The blur was
  scaled for far larger type than TEMPO uses, so the letters were destroyed at
  the crossover. It's also considerably slower now.
- Fixed (v0.71.1): the heading inside the name box could fail to render at all,
  taking the look of the panel with it.
- Changed (v0.71.1): the opening frame is darkened behind the text so the first
  lines have something to sit against, and the film grain is much stronger — it
  was there before, but far too faint to see on footage this dark.

- Changed (v0.71.0): TEMPO's voice in Origin now morphs from one line into the
  next — the letters melt and reform rather than fading. It's used everywhere
  the thing talking to you speaks, and nowhere else.
- Changed (v0.71.0): every clip carries film grain now, and only the transitions
  have sound — the loops you sit on while typing or talking stay silent.
- Fixed (v0.71.0): the flash between clips. Both were fading at once, so the
  midpoint of every handoff dipped dark. The outgoing shot now holds while the
  next one fades in over the top of it.
- Changed (v0.71.0): the last transition now freezes on its final frame and the
  scrolling chapter fades in over it, instead of cutting mid-motion.
- Changed (v0.71.0): as you scroll your story, each chapter rises toward you
  from the left, holds, then drifts past — following the movement of the film
  rather than sitting still on top of it. Chapter titles are white, the panels
  sit middle-left, the scrollbar is gone, and there's a small scroll cue under
  the opening chapter.
- Changed (v0.71.0): panels sit further in from the right edge, "tap anywhere to
  begin" now genuinely means anywhere, and the writing throughout Origin is less
  on-the-nose.
- Changed (v0.71.0): Enter TEMPO always opens your workspace now, since bringing
  your music in already happened inside the story.

- Fixed (v0.70.0): signing into a different account on the same computer could
  leave the previous account's track sitting in the player at the bottom of the
  screen — their song title and artwork, visible to someone who shouldn't see
  them. Playback is now kept per account, switching accounts clears the player
  immediately, and anything left behind by the old behaviour is wiped.
- Changed (v0.70.0): "Bring your music in" now runs inside Origin itself. The
  film stays behind it and finishing returns you to your story, instead of
  dropping you onto a separate page mid-onboarding.
- Fixed (v0.70.0): the opening chapter of your story sat slightly right of
  centre instead of left, where it was meant to be.

- Added (v0.69.0): Origin now opens with sound. It waits on a still frame while
  a few lines surface — "Something is listening", "A pulse, finding its
  footing" — and starts when you tap. That tap is also what lets the film play
  with its audio; browsers won't allow sound before you've touched the page.
- Changed (v0.69.0): the clips now genuinely dissolve into one another instead
  of one stopping and the next starting. The outgoing shot keeps moving
  underneath the incoming one for the whole blend, and the sound crosses with
  it.
- Changed (v0.69.0): the panels now sit to the right of the screen rather than
  the middle, so they stop covering the subject of the footage, and they fade
  in properly instead of appearing all at once.
- Changed (v0.69.0): "Bring your music in" is now a chapter of the Origin story
  rather than somewhere you get sent afterwards — you choose there, and Enter
  TEMPO takes you where you chose.
- Changed (v0.69.0): the closing of Origin has a proper Enter TEMPO button, and
  your story now always seeds your private profile rather than asking — it only
  ever fills blanks and still never publishes anything.
- Changed (v0.69.0): your artist name is now required rather than skippable —
  everything after it is built from it.
- Fixed (v0.69.0): "Replay introduction" in Settings did nothing. It now
  replays the whole thing from the first frame.

- Fixed (v0.68.0): the story at the end of Origin didn't respond to scrolling,
  which also meant "Enter TEMPO" was out of reach and there was no way to
  finish. Scrolling now moves through your story as intended, and there's a
  quiet "Skip to the end" button visible the whole way through so the way out
  is never something you have to scroll to find.
- Changed (v0.68.0): Origin flows better between steps. The name box, the
  speaking panel, and the review all now fade in over the last moment of the
  film before them, so they're already settled by the time the scene lands —
  instead of the film stopping, a beat of nothing, then a box appearing.
- Fixed (v0.68.0): "Back" from the story now returns you to the review step
  rather than doing nothing.

- Fixed (v0.67.1): Origin's videos never appeared — you'd get a still frame or
  a black screen instead of the film. A mistake in the handoff between clips
  meant TEMPO waited forever for the next video to be ready and never showed
  it. The film now plays.

- Added (v0.67.0): **Origin** — TEMPO's new welcome for a first-time artist.
  Instead of landing straight in an empty workspace, the app opens with a short
  film: it asks who you are, then asks you to talk for half a minute about what
  you make and why. You can speak it or type it, whichever you prefer. TEMPO
  listens and writes back a first draft of your story — what you seem to
  promise a listener, what keeps pulling you back, and the chapter you're
  opening right now. Every word of it is yours to edit, rewrite, or throw out,
  and you can ask for a different reading without losing the one you have. It
  ends with your story unfolding as you scroll, and then TEMPO opens up around
  you. Nothing from Origin is published, and nothing is shared — it's yours,
  privately, and you can revisit or rewrite it any time from Settings.
- Added (v0.67.0): if you'd like, Origin can quietly use what you wrote as the
  start of your private artist profile. It's off unless you tick it, it only
  fills in blanks — it never overwrites anything you've already written — and
  it never makes your profile public or turns Social on.
- Changed (v0.67.0): Origin only ever appears for a brand-new artist. If you
  already use TEMPO, nothing changes and you'll never be pushed into it, and
  switching between your artists won't drop you into onboarding either.
- Under the hood: **run migration `042_artist_origins.sql` in Supabase before
  this reaches anyone.** Until it's run, TEMPO behaves exactly as it does today
  — new sign-ups go straight to Bring Your Music In, as before.

- Changed (v0.66.3): the boot video looks sharper. It now plays at its full
  original resolution instead of a shrunken copy — and it actually got
  *smaller* to download, not bigger. A fine film grain sits over the top,
  which gives the soft light something crisp to sit against and clears up
  the faint banding you get in the darker areas.

- Fixed (v0.66.2): the boot video plays smoothly now. It was being pushed
  through the same graphics pipeline that draws the moving light in the app,
  frame by frame, while that light kept drawing away behind it — the two were
  fighting for the graphics card and the video lost, unevenly. The video now
  plays directly, the background light pauses while it's on screen, and the
  graphics effect only switches on for the dissolve at the very end.

- Fixed (v0.66.1): the boot moment is smooth now. The video starts loading
  quietly while you're on the sign-in screen, so it's ready to go the moment
  you're through, and it waits until it actually has enough to play instead
  of stuttering through the opening. You also no longer catch a glimpse of
  the app for a split second before the video takes over.

- Changed (v0.66.0): the boot video now plays *after* you sign in, not before.
  The sign-in screen is plain again, and the video runs as the loading screen
  while your workspace loads behind it. The ending is a true dissolve now —
  the picture breaks into prismatic streaks and fades through into the app
  instead of cutting. The **Skip** button also shows up sooner and is easier
  to see.

- Added (v0.65.0): the boot moment has a new look. Opening TEMPO (or the
  sign-in screen) now plays a short video — a spark igniting into the app's
  ice/white/amber light — with the TEMPO wordmark revealing letter by letter
  over it, before the whole frame dissolves into the app. It plays once per
  day per device rather than every time you open a tab, and it's skipped
  automatically if you prefer reduced motion (click or press any key to
  jump straight past it).

- Fixed (v0.64.1): re-running the messaging inbox database update no longer
  stops with an error partway through. It now skips work that's already been
  done, like the other updates do.

- Under the hood (v0.64.1): if a database update run stopped at
  `039_messaging_inbox.sql`, run it again — 040 and 041 come after it and
  won't have been applied yet.

- Added (v0.64.0): you can start a message with anyone. **New message** in both
  the message menu and the Messages page finds any artist on the network by name
  or handle and opens the conversation — no need to go to their profile first.
  If someone has direct messages turned off, TEMPO says so instead of failing.

- Added (v0.64.0): search now covers your messages. Artist conversations and
  TEMPO Support tickets — active and archived — are searchable by who they're
  with and by what was said in them, with their own **Messages** filter.
  Opening an archived result takes you straight to it in Archived.

- Changed (v0.64.0): search forgives spelling. A typo, or one wrong word in a
  title, still finds what you meant — "Fade from Dust" finds *Fade to Dust*.
  When the nearest thing is a real stretch, search says there's no exact match
  and offers it as a "did you mean" you can click.

- Changed (v0.64.0): the profile photo on artist headers now fills the banner
  top to bottom, sits closer to your name, and feathers into the artwork on
  every side instead of reading as a photo box dropped on top of it.

- Added (v0.63.3): direct and TEMPO Support messages now arrive through a
  private realtime notification stream, immediately refreshing the mini-inbox,
  full conversation, unread counts, notification center, and Admin Support.
  A timed refresh remains as a reconnect fallback, so no manual refresh is
  needed.

- Changed (v0.63.3): selecting a conversation in the top-right message menu
  now replaces the inbox list with that conversation's focused quick-reply
  view. A Back control returns to the compact inbox.

- Changed (v0.63.2): profile-header images are larger and blend into their
  banners with a broad, soft artist-colour halo. The short decorative line
  beneath the image has been removed.

- Changed (v0.63.1): docs and assistant copy now say clearly that a **project is
  not one track** (and a track does not need a project). Projects are work
  containers you define; album / EP / playlist buckets stay on Tracks as groups.

- Added (v0.63.0): on Tracks, you can split songs into named **groups** — an
  album, EP, playlist, or whatever bucket you need. Create a group, drag tracks
  in or out, rename or reorder groups, and remove a group without deleting the
  tracks (they land back in Ungrouped). Groups are only for organizing the
  Tracks list; they are not projects.

- Under the hood (v0.63.0): run migration `041_track_groups.sql` in Supabase
  before using groups.

- Fixed (v0.62.7): generated artist avatars now stay perfectly square inside
  circular map pins, and profile-header images keep their full circular edge
  instead of being stretched or clipped by overlapping size effects.

- Changed (v0.62.6): default artist avatars keep their initials but now use a
  restrained circular signal-disc design with subtle depth and palette-colour
  orbit accents instead of the glossy horizontal stripe.

## 2026-07-30

- Fixed (v0.62.5): re-running the calendar planning database update no longer
  fails when those planning rules were already applied once.

- Under the hood (v0.62.5): re-run migration `038_calendar_planning.sql` (and
  anything after it that didn’t finish) in Supabase / your migration runner.

- Added (v0.62.3): the Admin navigation now shows live count badges beside
  Support and Reports whenever either queue has open work. Counts refresh
  automatically and also update after an admin takes action.

- Changed (v0.62.4): Today now uses a simple sun icon without the upward
  arrow, while Calendar keeps its separate calendar icon.

- Changed (v0.62.4): artist profiles with no uploaded profile image now leave
  that space empty. Elsewhere, the old thin-bar placeholder is replaced by a
  readable artist-coloured monogram in feeds, messages, lists, and the globe.

- Changed (v0.62.4): profile-header images now sit to the right of the artist
  name and feather into the banner with a soft artist-colour glow and a fine
  Spectra light edge, replacing the plain circular-avatar treatment.

- Added (v0.62.0): Notifications, Messages, and Search now share the global
  top-right toolbar. Messages has its own unread badge and opens a mini-inbox
  with recent artist and TEMPO Support threads, quick reply, and a link into
  the full conversation. The TEMPO rail wordmark is larger now that the bell
  no longer occupies its header.

- Added (v0.62.0): direct and support messages now support live dictation,
  recorded transcription fallback, and up to four private image, audio,
  document, or archive attachments (10 MB each). Attachments use short-lived
  links checked against both thread membership and the original sender.

- Added (v0.62.0): the full Messages page and Admin Support inbox can archive
  and restore conversations, show unread state, and let a sender delete their
  own individual replies. A new reply automatically returns an archived thread
  to the recipient's inbox.

- Under the hood (v0.62.0): run `039_messaging_inbox.sql` after migration 036
  before using unread, archive, attachment, or support-message deletion features.

- Changed (v0.61.0): artist identity images can now be either a profile photo
  or an emblem. They appear as larger, circular avatars in the feed, on artist
  profiles, in messages, and around the Social globe, with a colour-mark
  fallback when an artist has not uploaded one.

- Changed (v0.61.0): the assistant now uses TEMPO's compact equalizer mark
  instead of borrowing the active artist's profile image.

- Added (v0.61.0): Calendar is now a complete creative planning workspace.
  It adds a six-stage Timeline, drag and bulk rescheduling, unscheduled-work
  suggestions, search and saved presets, workload and participant-conflict
  signals, natural-language scheduling, configurable week layout, and
  release-plan generation.

- Added (v0.61.0): custom events now support milestones and dependencies,
  recurrence, in-app reminders, participants, completion, links and briefs,
  comments, activity history, duplication, and CSV or print-to-PDF export.
  External calendar synchronization remains intentionally excluded.

- Changed (v0.61.0): Calendar now uses the calendar glyph previously shown
  for Today; Today uses a sunrise glyph so the two destinations are distinct.

- Under the hood (v0.61.0): run migration `038_calendar_planning.sql` after
  migration 037 to enable the expanded planning metadata and reminder
  delivery. Core Calendar events retain a migration-safe fallback.

- Changed (v0.60.0): the Admin overview is now an operating dashboard rather
  than a flat set of totals. It highlights work needing attention, 30-day
  member activation, growth, membership health, storage, and direct shortcuts
  into the support and moderation queues.

- Changed (v0.60.0): Usage analytics now has 7-, 30-, and 90-day views, richer
  metric cards, real area/line charts, useful zero-activity states, and a
  creation snapshot for tracks, projects, and AI users.

- Added (v0.60.0): Admins can reply to a support ticket as **TEMPO Support**.
  The member receives a private, two-way support conversation inside Messages,
  even if they have not joined the artist network. Member replies automatically
  reopen resolved tickets.

- Fixed (v0.60.0): invitation delivery now preserves Resend's safe rejection
  reason and shows deployment/sender health in Admin Invites, distinguishing an
  invalid key, testing-mode restriction, and an unverified sender domain.

- Under the hood (v0.60.0): run migration
  `036_support_conversations.sql` before using two-way support replies.

- Added (v0.59.0): **Calendar** is now its own desktop and mobile tab. It
  combines task due dates, track targets and next moves, project deadlines,
  releases, and pitching deadlines in Month and Agenda views. You can filter
  sources, switch between the active space and every space for the artist,
  and open any derived item at its real editor. Calendar event pills and
  agenda rows use TEMPO's cursor-following edge glow.

- Added (v0.59.0): create all-day or timed Calendar events for studio
  sessions, meetings, content, shows, personal plans, and other work, with an
  optional location, description, and related track or project.

- Under the hood (v0.59.0): run migration `037_calendar_events.sql` in
  Supabase to enable custom-event creation. Existing TEMPO deadlines still
  appear before the migration is applied.

- Added (v0.59.0): **Report a problem** now sits beside Settings and inside
  the Settings page. Members can send a bug, ask for help, or share feedback;
  the report includes only what they type, a privacy-safe page label, and basic
  browser information. The Admin console has a Support queue for triage,
  private notes, resolving, and reopening reports.

- Added (v0.59.0): the TEMPO assistant can turn a clearly described bug or
  help request into a support report. It shows the proposed report first and
  sends it only after the member confirms.

- Added (v0.59.0): members can report a post directly from the Social feed or
  report another artist from their published profile. Those reports enter the
  existing Admin moderation queue with only the specific public post or profile
  attached—never either person’s private workspace.

- Under the hood (v0.59.0): run migration `035_support_reports.sql` in
  Supabase before using product support reports.

- Changed (v0.58.1): the Social globe is a bit more willing to show nearby
  pins at full zoom-out — places like London, Amsterdam, and Berlin can sit
  together with a little overlap instead of collapsing to a single face.

- Added (v0.58.0): you can scroll to zoom the Social globe. When a bunch of
  people are piled into the same part of the world, only some pins show at
  first — zoom in and more appear as they get room to separate. Dispersed
  people still show together. Drag to spin, and tap Reset when you’re zoomed
  in to jump back out.

- Added (v0.57.0): the Admin console now has a dedicated usage analytics
  screen showing 90-day trends for assistant requests, storage growth,
  uploads, and focus time, plus current storage and useful 30-day totals.
  These are aggregate measurements only—admins still cannot open anyone’s
  tracks, projects, notes, audio, or other creative work.

- Added (v0.57.0): entering an email when creating a program invite now sends
  a dark, TEMPO-branded invitation containing that person’s unique code and
  one-click signup link. The Invites screen shows delivery status and supports
  sending the invitation again when needed.

- Under the hood (v0.57.0): run migration `034_admin_invite_delivery.sql`,
  then add `RESEND_API_KEY` and a verified `INVITE_FROM_EMAIL` sender in
  Vercel before sending invitation emails.

- Fixed (v0.56.4): you show up on your own Social globe now — if your Artist
  location is set (like Denver), your pin is there with everyone else’s.

- Changed (v0.56.3): Social globe shows a little more of the lower half, with
  a gentler fade into the page, and the atmosphere glow no longer clips flat
  against the top edge.

- Changed (v0.56.2): the Social globe is back to showing mostly the upper
  half of the earth, with a longer fade into the page at the bottom, and no
  ring — black or white — around the planet’s edge.

- Changed (v0.56.1): the Social globe is larger, and the hard black ring
  between the planet and its glow is gone — the edge softens into the
  atmosphere instead.

- Added (v0.56.0): a private Admin console for running TEMPO’s invited
  program. Platform admins can see member accounts and aggregate usage,
  suspend or reactivate access, remove an account with strong confirmation,
  issue and revoke individual invite links, review reported public content,
  and inspect a permanent log of privileged changes. Members’ tracks,
  projects, audio, lyrics, notes, feedback, comments, sessions, messages, and
  private profile content are deliberately excluded.

- Changed (v0.56.0): signup links can now carry a unique invite code, and a
  successful signup records which invite was used. The original shared invite
  code still works during the transition.

- Under the hood (v0.56.0): run migration `033_admin_console.sql` in Supabase,
  then set `ADMIN_EMAILS` in Vercel to the comma-separated email addresses that
  should be allowed into the Admin console.

- Changed (v0.55.0): the Social page has been rebuilt around three tabs —
  **Top 8**, **Follows**, and **Discover**. A spinning globe now sits under
  the tabs at all times, showing where the people you're connected to
  actually are in the world. Hover a face to slow the globe down and see who
  they are and where; click to open their profile. You can drag the globe to
  spin it yourself, and it's painted in your own artist colors, with the
  color washing slowly across the continents.

- Added (v0.55.0): **Top 8** — pick up to eight people to pin at the top of
  Social for quick access, the way you'd have on an old profile page. Add
  from anyone you follow or any contact linked to a TEMPO profile.

- Changed (v0.55.0): the feed moved to its own column down the right-hand
  side of Social and fades out at the bottom instead of taking over the
  middle of the page. The "Network" tab is gone — your contacts now surface
  through Top 8, Follows, and Discover instead.

- Changed (v0.55.0): **Discover** now shows artists you've recently worked
  with before you've typed anything, so it's a place to reconnect rather than
  just an empty search box.

- Changed (v0.55.0): posting to the feed starts as a single line. Click it and
  the rest — image, track, and who can see it — opens up, so the composer
  stays out of the way until you're actually writing.

- Changed (v0.55.0): setting your **location** on the Artist page now suggests
  cities as you type — type "den" and pick "Denver, CO, USA". That's what
  places you on the Social globe, so filling it in is how you show up there.

- Fixed (v0.55.0): artist logos were blowing up to enormous size in the feed,
  in Messages, and anywhere else they appeared without a fixed size — they
  now stay the size they're meant to be.

- Added (v0.54.0): search now covers your feed, too — posts from you and the
  people you follow show up alongside tracks, projects, and everything else.
  Pick one from the filter bar to jump straight to it and open the
  conversation.

- Changed (v0.53.9): the thin animated light strip along the very top of the
  app is smaller now — more of a subtle accent than a bold band.

- Fixed (v0.53.8): the search bar's glow was bleeding down onto the row of
  buttons below it on Board and Projects (Sort/Filter/Stages/Track), making
  things look blurry and crowded. It now sits with proper clearance on every
  screen.
- Changed (v0.53.7): search bar redone — the glowing border now matches
  TEMPO's own ice/amber accent colors instead of the leftover purple/pink,
  the bar is sized down closer to the rest of the header, and the fade that
  was washing out your typed text is gone. Hovering now speeds the glow up
  smoothly (no more visible jump) and blooms a soft halo around the whole
  bar; it settles back down the instant your mouse leaves instead of
  staying sped up.
- Changed (v0.53.6): search placeholder reads “Search tracks, artists,
  details…” instead of calling out BPM.
- Changed (v0.53.5): search bar brings back the colorful glowing border
  (purple / pink conic layers), with slower, smoother motion on hover and
  focus.
- Changed (v0.53.4): a little less space above the search bar, a little more
  below it.
- Changed (v0.53.3): search glow follows your cursor the same smooth way
  track cards do (ice → white → amber), instead of the fast spinning border.
- Fixed (v0.53.2): search lines up with the right edge of the page content
  (same column as Today/Board), instead of floating short of it.
- Changed (v0.53.1): search sits flush on the right with the rest of the page,
  and the “⌘K to focus” line under it is gone.
- Added (v0.53.0): a glowing **search** bar at the top of every screen. Type
  and results pop up grouped — tracks (including BPM, key, tags, artist name,
  genre, next move), projects, tasks, people from your network, board notes,
  stages, spaces, and quick jumps to pages like Board or Stats. The filter
  button narrows to one category; arrow keys and Enter pick a result; ⌘K / Ctrl+K
  focuses the bar. Searching a track in another space switches you there when
  you open it.
- Changed (v0.52.0): socializing is optional. On **Artist** you toggle
  **Off the network** / **On the network** — off means private (nobody can
  find or follow you); on lets you pick TEMPO members or a public link.
  **Social** still shows your private contact book and orbit when you're
  off; Feed, Follows, Discover, and Messages ask you to join first (one
  tap), with a link back to network settings.
- Fixed (v0.51.1): emblems on the Social orbit actually show and sit on the
  rings — the spin animation was shoving them off their spots, and the
  constellation is centered in the panel so you can see them.
- Added (v0.51.0): **Social** is live — your private network of collaborators,
  guest reviewers and release credits, searchable and filterable, with a link
  through to anyone who already has a TEMPO artist profile.
- Added (v0.51.0): **Follow / unfollow** other TEMPO artists from their
  profile, with following and follower lists on Social. Blocking someone
  clears the follow both ways.
- Added (v0.51.0): a **Discover** search for published artist profiles by
  name, and a constellation **orbit** at the bottom of Social that draws
  people from your network (hover a node for who they are and how you know
  them; click through to their profile or contact card).
- Added (v0.51.0): a **feed** on Social — post an update (with an optional
  image or one of your own tracks), @mention someone by their handle, like
  and comment. Visibility can be followers-only, TEMPO members, or public.
  Your home feed shows your posts plus posts from people you follow.
- Added (v0.51.0): **direct messages** — start a thread from someone's
  profile (respecting their "who can message you" setting), send messages
  both ways, and see unread counts clear when you open the thread.
  Messages lives at its own screen, reachable from Social.
- Under the hood (v0.51.0): migrations 029–031 apply automatically on push —
  no manual step in the Supabase SQL editor.

- Fixed (v0.50.1): your artist emblem on the Artist profile page was showing
  inside a boxed, opaque background and getting cropped to a square. It now
  shows at its own true shape and transparency, sitting right next to your
  name at the same height — with your handle and tagline lined up flush
  underneath the name, not the emblem.
- Added (v0.50.0): the **Artist** page is now a real editable profile — a
  tagline, bio, backstory, location, pronouns, genres, roles, and up to 12
  links, plus who's allowed to message you. Nothing here is visible to
  anyone else until you choose to publish it.
- Added (v0.50.0): **visibility controls** for your profile — keep it
  **Private** (just you), open it to **TEMPO members** (anyone signed in can
  look you up), or go **Public link**, which also makes it reachable by
  anyone with the link, no TEMPO account needed.
- Added (v0.50.0): a **handle** — a short, shareable @name for your public
  link and future @mentions. Your artist name stays the prominent thing
  everywhere in TEMPO; the handle is just the address.
- Added (v0.50.0): visiting another TEMPO artist's profile (once they've
  published one) now shows their bio, backstory, genres, roles and links —
  reachable once the network view lands.
- Under the hood (v0.50.0): **run migration 028 in Supabase** before any of
  this works. Until then, the Artist page shows its old "nothing here yet"
  placeholder and nothing breaks.

- Changed (v0.49.0): the old **Artist** page — banner, headline numbers, the
  year in bounces, pipeline, your sound, and everything else it tracked — is
  still exactly where it was, just renamed **Stats** and moved to its own spot
  in the left rail. Nothing about it changed except the name and location.
- Added (v0.49.0): **Artist** is now your public-facing profile page — the
  start of a page other people will eventually be able to look up: your name,
  your branding, and soon a bio and backstory. It's a placeholder today; the
  editable bio, links and visibility controls are coming next.
- Added (v0.49.0): a new **Social** tab in the left rail — a first look at
  what's coming: your network of collaborators and other artists on TEMPO,
  with follows and a feed to follow in later updates.



- Fixed (v0.48.0): the Artist page's **layout arrangement now follows your account**, not just the browser you set it up in. It used to be saved only to that one device, so a custom module you built at home wouldn't show up when you checked the site from your phone or another computer — same data, different arrangement. Now "Edit layout" is the same wherever you sign in. An arrangement already saved on a device carries over automatically the first time that browser loads the page after this update.
- Added (v0.48.0): each stat inside a **custom module** now draws a proper filled area chart once it has two or more logged readings — a date under each end, a dot on every reading — instead of just a list of numbers.
- Added (v0.47.0): **layout templates** for the Artist page. Open "Edit layout" and pick a starting point — **Overview** (everything), **Minimal** (just the shape of things), **Statistics** (numbers first), or **Platforms** (Spotify/SoundCloud/Apple Music lead) — then rearrange freely from there. Your own arrangement is never touched until you pick one.
- Added (v0.47.0): **custom stat modules** on the Artist page — build your own tracker for anything TEMPO doesn't already measure: sync placements, merch sold, radio spins, an Instagram follower count, whatever matters to you. Create a module from "Edit layout", then add as many named stats as you like (with an optional unit) and log a reading for any date right from the card. Log as often as your own updates happen — each reading is kept, so a stat with two or more readings gets its own trend line. Made a typo? Each stat shows its recent readings with a one-tap undo. Rename or delete a whole module from its own header.
- Under the hood (v0.47.0): database migrations now apply automatically when this project is pushed, instead of needing to be pasted into Supabase by hand.

- Added (v0.46.0): **Spotify, SoundCloud and Apple Music sections** on the Artist page. Paste your profile link once and each one starts reporting:
  - **SoundCloud** — plays, followers, likes and reposts, plus your most-played tracks.
  - **Spotify** — your releases as Spotify lists them.
  - **Apple Music** — your releases as Apple lists them.
  Each section says plainly what it can't show. SoundCloud is the only one of the three still giving apps real numbers: Spotify removed follower counts, popularity and top tracks from its API in February 2026, and Apple's statistics need a paid developer membership — so both of those are catalog listings only. TEMPO never guesses at the missing numbers, and stream counts were never available outside Spotify for Artists anyway.
- Added (v0.46.0): because SoundCloud only ever hands over *today's* totals and no history, TEMPO records them once a day and draws the trend itself. The section shows a flat number on day one and a line from day two, so the curve builds as you go.
- Under the hood (v0.46.0): **run migration 024 in Supabase** before this works, and add the Spotify and SoundCloud keys to your environment. If you skip either, the sections just say they aren't linked — nothing breaks. Apple Music needs no keys at all.

- Added (v0.45.0): a new **Artist** page — everything under one artist name, across every space at once. It opens on your banner, logo and a headline row (tracks, bounces, in progress, released, focus time), then:
  - **The year in bounces** — twelve months of bounces uploaded against tracks started, so a year of work is visible in one glance.
  - **Pipeline** — where tracks sit in each space's stages, one bar per space so several spaces stay readable.
  - **Spaces** — all of an artist's spaces side by side with their own counts and when each was last touched; tap one to switch to it.
  - **Your sound** — the shape of your tempos, the keys you write in most, your genres and track types.
  - **Work rhythm** — when you actually work, by day and hour, plus your busiest day, busiest hour and how many weeks in a row you've kept going.
  - **Longest in progress** — the oldest unfinished tracks and how long they've sat in their current stage.
  - **Releases** and **Feedback received** — countdowns to what's coming, what's already out, and how much feedback has come in from guests versus your own notes.
- Added (v0.45.0): the Artist page is **modular** like a track workspace. "Edit layout" in the top-right of the banner lets you drag sections between the two columns, reorder them, drop one onto another to combine them into tabs, and hide what you don't want (hidden sections stay one click away). Reset puts it back. Your arrangement is remembered per artist, on that device.
- Added (v0.45.0): **Artist** is now in the left rail, and "Artist overview" sits in the artist dropdown.
- Changed (v0.45.0): the charts on the Artist page follow the artist's own Cool / Warm colours, adjusted so large filled shapes stay readable on the dark background.
- Added (v0.45.0): your **emblem** now shows on the browser tab, on the assistant's round button, and beside the assistant's replies — so which artist you're working in reads at a glance, even across several tabs. Without an emblem uploaded you get your artist's own colour mark instead, and the tab keeps TEMPO's icon.

## 2026-07-29

- Removed (v0.44.3): all special effects on the Today logo — it's just your logo again. Also, if you haven't uploaded an emblem, the artist switcher shows only the name (no placeholder mark).
- Changed (v0.44.2): the Today logo cutout is a bit more visible — still see-through to the lightfield, just easier to read the letters.
- Fixed (v0.44.1): the Today logo cutout actually punches through the banner now (the first try used a CSS blend mode browsers don’t support, so the logo still looked solid).
- Changed (v0.44.0): the Today logo is a cutout — the letter shapes punch through the banner so the moving lightfield shows through them (the line/flare effect is gone).
- Changed (v0.43.9): the Today logo effect is slow vertical Spectra lines rising through the letters in your Cool / Warm colours — reads more like the lightfield behind it than a quick flare streak.
- Fixed (v0.43.8): the Today logo flare reads clearly now — it was blending in a way that made it disappear on white logos; the ice → amber streak paints through the letters about every 3 seconds.
- Fixed (v0.43.7): the Today logo flare actually shows — the sweep loads the image in a way that clips correctly and runs brighter / more often.
- Changed (v0.43.6): the Today logo loses the soft glow — instead a thin ice → white → amber lens-flare streak sweeps across it (still when reduced motion is on).
- Changed (v0.43.5): the Today logo gets a soft ice/amber glow that gently breathes (stays still if you prefer reduced motion).
- Changed (v0.43.4): the Today logo is a bit smaller again.
- Changed (v0.43.3): the Today logo is anchored flush to the bottom-right of the greeting panel (not floating mid-banner).
- Changed (v0.43.2): the artist **logo** on Today sits in the bottom-right of the greeting panel, a bit larger.
- Changed (v0.43.1): the artist **logo** on Today is larger and sits tighter in the top-right corner.
- Changed (v0.43.0): your **emblem** sits next to the artist name in the left rail; the **logo** is larger and tucked into the top-right on Today (and previewed on the Settings banner). Custom Cool/Warm and custom banner gradients open from a **Custom** button instead of sitting in the row.
- Added (v0.42.0): artists can have a **logo** (wide lockup, shown larger on Today) and a separate **emblem** (square profile mark in Settings / the artist list). Upload each in Settings.
  - Under the hood: **run migration `023` in Supabase** so emblems can save. (Migration `022` is still needed for custom colors.)
- Added (v0.41.0): in Settings you can pick **custom Cool / Warm colors** (opens a colour slider) on top of the presets, and a **custom banner** with an optional second colour for a soft gradient. Choosing a preset clears custom accents again.
  - Under the hood: **run migration `022` in Supabase** so custom colors can save.
- Changed (v0.40.0): Settings labels the accent picker **Color** (not Colour). There are more accent palettes — including a black-and-white **Noir** — and more banner color washes to pick from.
- Fixed (v0.39.2): logo and banner changes in Settings update right away (with a short “Uploading…” / spinner while a file is still going up) instead of sitting still until a later refresh.
- Fixed (v0.39.1): choosing **Spectra (default)** again restores the original lightfield look — other palettes still tint the field.
- Changed (v0.39.0): picking an artist **colour palette** in Settings now also re-tints the moving light behind the app (and the still fallback when motion is off) — same ice / amber tones as the rest of the UI.
- Changed (v0.38.0): your artist **logo** no longer sits next to the name in the left rail — it shows on **Today**, top-right of the greeting, at a comfortable size.
- Added (v0.37.0): TEMPO now works for more than one artist name. Add an **artist** in Settings — each one keeps its own spaces, tracks and projects, and you switch between them from the left rail. Everything you already have moves onto one artist automatically, so nothing changes until you add a second.
  - Each artist gets its own look: pick one of six **colour palettes**, upload a **logo**, and set a **banner** (your own image, or one of six colours). The banner shows behind the greeting on Today and on the artist's card in Settings.
  - Your colours carry through the whole app — buttons, the board's stage colours, the covers TEMPO draws for tracks without artwork, and the waveform. A bounce you share by guest link shows that artist's colours too.
  - Whatever you pick, it still looks like TEMPO: the palettes are a fixed set chosen to stay readable on the dark UI, green still means good and red still means blocked for every artist, and the TEMPO mark itself doesn't change. Leave everything untouched and the app looks exactly as it did.
  - Under the hood: **run migration `021` in Supabase before this deploys** — the app won't load spaces without it.

## 2026-07-28

- Changed (v0.36.7): **Remove** on Board cards is quieter again (still always visible, a bit clearer on hover).
- Changed (v0.36.6): **Remove** on Board cards is muted but always visible (clearer on hover).
- Changed (v0.36.5): **Remove** on Board cards is a bit easier to see on hover (still hidden until you hover the card).
- Changed (v0.36.4): **Remove** on Board cards stays invisible until you hover the card, then only faintly.
- Changed (v0.36.3): **Remove** on Board cards is barely visible until you hover it.
- Changed (v0.36.2): tracks with no stage stay hidden on the Board — use a stage’s **+ → Existing track…** to place them. The card control is a dark **Remove** (clears the stage, doesn’t delete).
- Changed (v0.36.1): Board copy talks about **stages** instead of “off/on board.”
- Added (v0.36.0): each Board stage has a **+** to add an existing track with no stage, start a new track in that stage, or pin a **sticky note** (board-only reminder — not a track). Notes drag between stages; delete removes them.
  - Under the hood: **run migration `020` in Supabase** so sticky notes can save.
- Fixed (v0.35.2): after you clear a track’s stage, you can place it again from a stage’s **+ → Existing track…** (or pick a stage on the track page).
- Fixed (v0.35.1): saving a named track order now tells you clearly if migration `018` still needs running in Supabase (instead of a vague failure).
- Added (v0.35.0): you can clear a track’s stage without deleting it — it stays in Tracks; place it again from a stage’s **+** or the track page.
- Added (v0.34.0): Tracks has the same Comfortable / Compact density toggle as the Board — Compact is a thin text row (title, momentum, stage), no cover or extra meta.
- Added (v0.33.0): spaces can now be **tasks-focused** instead of music-focused — pick "Tasks & projects" when creating a space, or flip it later in Settings. A tasks-focused space drops Board and Tracks from the nav and Today, and shows open tasks and project progress instead. Good for something like running social media out of TEMPO alongside your music.
  - Under the hood: **run migration `019` in Supabase.** Tasks are now scoped to their space — existing tasks with no track or project link (and projects with no space) won't show up until you re-add them inside a space.
- Fixed (v0.32.1): Sort / Filter menus no longer stretch or jump the Tracks (and Board) header — they open as a floating panel, and Filter shows a count instead of a long label.
- Changed (v0.32.0): Board and Tracks **Sort** and **Filter** live in the header as small menus (no full-width bar when closed). Board can also sort cards inside each column (Custom, title, updated, deadline).
- Changed (v0.31.1): Board and Tracks filter/sort bars take less room — smaller chips, one compact toolbar, and Filters tuck away until you open them (Tasks got the same denser bar).
- Added (v0.31.0): on Tracks, **Save order** stores your Custom arrangement under a name and adds it to the Sort row — pick it anytime later. You can also apply a saved order as Custom, overwrite one from Custom, or remove it.
  - Under the hood: **run migration `018` in Supabase** so named orders can stick. (Migration `017` is still needed for the live Custom drag order.)
- Added (v0.30.0): on Tracks you can filter (type, stage, tag, blocked/waiting/overdue) and sort (Custom, title, stage, updated, deadline). Custom is the default — drag rows to rearrange, and the order is saved.
  - Under the hood: **run migration `017` in Supabase** so custom order can stick. Without it, Tracks may fail to load or reorder.
- Fixed (v0.29.1): Board density icons were swapped — fewer lines is Comfortable, more lines is Compact.
- Changed (v0.29.0): Board Compact density is now a thin text row — title only (plus a tiny momentum / blocked mark), no cover art or extra meta — so packed columns stay easy to scan.
- Fixed (v0.28.1): cover art (and other private files) no longer re-download every time you open a page — TEMPO reuses the same download link for about an hour so covers appear instantly when you move around or refresh.
- Changed (v0.28.0): the assistant can now propose track edits you confirm — BPM, key, genre, title, type, blocked/waiting, and the stage/momentum/deadline/next-move changes it already knew — so asking to set a song to 174 BPM should bring up a confirm button instead of a dead end.
- Added (v0.27.0): the floating assistant now has a mic and a paperclip like Import — talk in (live dictation, or record-and-transcribe), and attach screenshots, PDFs, or text files with your question.
- Changed (v0.26.0): the floating assistant can propose more real workspace moves now — including moving a track to another stage, setting a next move, setting a task due date, and adding a project — still only after you tap to confirm, and it still won't delete anything.
- Fixed (v0.25.4): the notifications panel was sitting behind Today and other page content — it now opens in front.
- Fixed (v0.25.3): the notifications panel was opening off the left edge of the screen — it now opens into the workspace so you can read it.
- Fixed (v0.25.2): the floating assistant was failing on ordinary questions (like how many songs you have) and only saying it couldn't answer — it should reply properly again.
- Fixed (v0.25.1): Today's drifting cover strip no longer runs out and jumps back — it loops continuously.
- Added (v0.25.0): a floating **assistant** in the bottom-right of every main screen — tap the TEMPO mark (or press Cmd/Ctrl+/) to ask how something works or what's going on in your catalog. It can propose a small change (add a task, mark one done, set a deadline, open a screen); nothing is written until you confirm. Hidden on Focus and Import so those stay distraction-free.
  - Under the hood: **run migration `016` in Supabase** before relying on the daily ask limits. Without it the assistant still answers, but usage tracking won't stick across servers.
- Changed (v0.24.7): Spectra cover **backgrounds** use an even broader hush palette (coral, sky, sand, orchid, aqua, berry, honey, and more) and soft tri-hue blends — slits stay ice / white / amber / gray.
- Changed (v0.24.6): Spectra cover **backgrounds** are softer and use a wider hush palette (teal, rose, lilac, mint, peach, and more) — the slits themselves stay ice / white / amber / gray.
- Changed (v0.24.5): Spectra cover backgrounds are back to the quiet studio-light set (cool rim, warm floor, white haze, side leaks, gray mist, corner glow).
- Changed (v0.24.4): another Spectra cover background option — quiet “print” textures (cool/warm scanlines, soft inset frame, diagonal hairlines, flare whisper, grain) instead of the studio-light set.
- Changed (v0.24.3): Spectra cover backgrounds are quieter now — soft studio lighting (cool rim, warm floor, white haze, side leaks, gray mist, corner glow) instead of the loud color panels.
- Fixed (v0.24.2): Spectra cover backgrounds were invisible (a blur layer was covering them). They’re painted inline now and should read clearly — ice wash, amber wash, diagonal split, band stack, corner blocks, or a white well — behind the slits.
- Changed (v0.24.1): Spectra placeholder covers now show up wherever a track’s artwork would — Tracks list, Board cards, track header, project track rows, and Today’s attention list — not only the Today strip. Backgrounds are also much more obvious (ice panel, amber panel, diagonal split, band stack, corners, white well).
- Changed (v0.24.0): temporary cover slits sit in a mid length range (not too tall or short), and each track gets a more distinct Spectra **background** (ice bloom, amber pool, diagonal split, horizons, corners, or a soft striped well) so covers are easier to tell apart without changing the title language itself.
- Changed (v0.23.9): temporary covers are denser again, and the Spectra art palette is ice / white / amber / gray only — no purple.
- Changed (v0.23.8): temporary covers are sharper (less blur), the horizontal flare line is gone, and each track uses a stronger layout/color mode so they look more distinct from each other.
- Changed (v0.23.7): temporary covers have more distinction per track — different silhouettes, spacing, height waves, and background bias so they don’t all look the same.
- Changed (v0.23.6): temporary covers keep the light brightest in the middle (quieter at the sides and on each slit’s ends), with a quiet ice→amber Spectra background under the lines.
- Changed (v0.23.5): temporary covers are vertical again — soft vertical Spectra slits from the title language, with a light blur (not the heavy glow, not the hard chrome look).
- Changed (v0.23.4): temporary covers try another Spectra look entirely — stacked horizontal “aurora” ribbons from the title language (soft blur, slow drift), instead of vertical columns.
- Changed (v0.23.3): temporary covers try a different Spectra look — sharper vertical columns, ice/amber chromatic split, a thin flare line, and much less soft glow.
- Changed (v0.23.2): temporary Spectra covers glow softer now — blurred bloom behind the slits, a light prismatic haze, and a fade at the edges so they feel closer to TEMPO's light field.
- Changed (v0.23.1): temporary Spectra covers have more line variety again — common letters sit at medium weight, thick is for accents, and overall slits are a bit slimmer.
- Changed (v0.23.0): temporary Spectra covers are denser — short titles repeat more, featuring / parenthetical text is part of the art again, and common letters (including vowels) draw thicker slits so the field doesn’t look sparse. Long titles are still capped.
- Added (v0.22.0): temporary covers are now shaped by the **Spectra Title Language** — each track's title quietly drives the color, length, weight, and seat of the vertical light slits (featuring credits left out of the art; numbers count like letters). Design-first, not a puzzle to decode. Same language can be reused elsewhere later.
- Changed (v0.21.7): temporary covers now look like TEMPO's Spectra field — vertical ice/white/amber light slits on black, each track getting its own pattern so they don't all match.
- Changed (v0.21.6): Today's cover strip and the temporary Spectra sleeves drift slower and smoother — the laggy blur on moving bands is gone.
- Changed (v0.21.5): temporary covers match TEMPO's Spectra look — soft rectangular blurred light bands that drift, instead of circles or a big letter.
- Changed (v0.21.4): temporary covers for tracks without art are abstract Spectra sleeves now (glow, rings, flare) — no big letter.
- Changed (v0.21.3): tracks without cover art still show up in Today's drifting strip — each gets a temporary TEMPO-styled cover (glow + title) until you upload real art.
- Changed (v0.21.2): Today's cover strip drifts slower, the covers are larger, and they sit faded until you hover one.
- Changed (v0.21.1): the cover strip on Today is label-free — just the drifting artwork as a design piece.
- Added (v0.21.0): **Today ends with a slow-moving strip of your track covers** — two rows drifting opposite ways. Tap any cover to open that track. Tracks without art still show their usual colour gradient. If you prefer reduced motion, the strip sits still and you can scroll it yourself.
- Fixed (v0.20.1): when you import a song whose title includes a featuring credit — like "Midnight (feat. Lena)" — TEMPO keeps that in the title instead of stripping it out.
- Changed (v0.20.0): **the sign-in and create-account screens now show the TEMPO wordmark instead of plain text**, and the light field on the right sits inside its own large rounded window rather than fading across the whole page — the left side is now a plain, solid panel.
- Added (v0.20.0): **creating a new account now needs an invite code.** Anyone without one sees a "Request an invite" link that emails you directly. Existing accounts are unaffected — this only gates new sign-ups through the form.
  - Under the hood: set `INVITE_CODE` in `.env.local` and in Vercel's environment variables to whatever code you want to hand out — signups are closed until it's set. Signing up via Google/Microsoft/Apple has been removed from the create-account screen for now, since those can't be gated by the code; they still work from the sign-in screen for people who already have an account.
- Changed (v0.19.0): **the sign-in and create-account screens are now two-column on desktop.** The left side has the form; the right side is the animated Spectra light field — no extra imagery, just the thing that already makes TEMPO feel like TEMPO. Both pages also now have "Continue with Google", "Continue with Microsoft", and "Continue with Apple" buttons below the email/password form, so you can sign in with your existing account from any of those providers (each one needs to be turned on in Supabase before it goes live). The password field now has a show/hide toggle.

## 2026-07-27

- Fixed (v0.18.3): importing a batch of new singles no longer wraps each one in its own project. Projects are for real groupings now — an EP, an album, an edit pack, or a campaign — so a handful of unrelated new songs come in as plain tracks with no project attached. Say you're working on an EP or album (or the material clearly names one with several tracks under it) and TEMPO still groups them the way it did before.

- Fixed (v0.18.2): TEMPO was asking two or three unrelated questions at once during the import conversation — a multiple-choice one followed by a couple of open-ended ones, all stacked in a single message. It now asks one thing at a time, picks whichever question matters most first (like whether a batch of tracks belongs to one project, before asking about any single track's stage), and waits for your answer before moving to the next.

- Fixed (v0.18.1): earlier in the import conversation, replying to one of TEMPO's questions made the question disappear — the thread looked like a pile of your own messages rather than a back-and-forth. It's a proper conversation now: TEMPO's questions stay on screen next to whatever you answered.
- Added (v0.18.1): **talking to TEMPO now works like dictation, not a recording.** In Chrome, Edge, and Safari, tap the mic and your words appear in the message box live, as you speak — so you can fix a mangled song title before it's sent, instead of finding out afterward. Browsers without that support (Firefox) fall back to the previous record-and-transcribe behaviour.

- Added (v0.18.0): **you can delete tracks properly now.** On the Tracks page, hit "Select", tick as many tracks as you want, and delete them together — you get a confirmation naming every track going and warning that their bounces, comments, checklists and session history go with them. On a track's own page, delete now lives in a new **Edit** menu in the bottom-right of the track's header, alongside "Edit layout". It used to be buried inside the Details panel, which most layouts hide — so on a lot of setups there was no way to delete a track at all.
- Changed (v0.18.0): **the import screen is a conversation now.** Instead of three separate boxes for files, text and voice, it's one chat: type, hit the mic, or drop files straight in, all in the same thread. TEMPO answers as you go — it tells you what it actually found in what you sent ("That screenshot lists 12 project folders; looks like 8 songs"), and asks for what's missing rather than waiting until the end to guess. Answer in your own words or tap one of the suggested answers. Screenshots and spreadsheets are read the moment you attach them, so you can talk about what's in them straight away.
- Changed (v0.18.0): TEMPO asks more questions when you've given it less to work on, and fewer when you've been thorough — up to eight on the review screen, rather than a fixed handful.
- Added (v0.18.0): a "Got a lot to add? Import them all" link in the New track box, for when adding them one at a time isn't the right tool.
- Fixed (v0.18.0): building a workspace could leave the import stuck showing "building" forever if you double-clicked or your connection dropped — the workspace was built correctly, but the screen never moved on.
- Under the hood: **run migration `015` in Supabase** (as well as `014`). It fixes the stuck-import problem above and repairs any import already affected.

- Added (v0.17.0): **you can now bring your existing music into TEMPO instead of typing it all in.** There's a new "Bring your music in" screen — you'll land on it when you make a new account, and it's always there under Settings → Import. Give it whatever you already have: type or paste a song list, describe your catalog in your own words, record a voice note, drop in screenshots of your project folders or a whiteboard, or upload a release spreadsheet, PDF, or Word doc. TEMPO reads all of it together and proposes a workspace — tracks with their stage and momentum, EPs and albums, tasks, target dates, who you're waiting on. Nothing is added to your catalog at that point. You get a review screen split into "Ready to add" and "Needs your eyes", where every single thing is editable and tells you where it came from and how sure TEMPO is ("From the folder 'EP Echoes'"). If it spots something ambiguous — three files that look like the same song at different stages, or a title you already have — it asks you rather than guessing, and you can answer with one tap and have it redraft. Untick anything you don't want. Only when you press "Build my TEMPO workspace" does anything get created, and it's created all at once — if something goes wrong, nothing is added rather than half a catalog. You can discard an import at any point, which deletes the files you uploaded along with it.
- Under the hood: **run migration `014` in Supabase before using this**, and add an `OPENAI_API_KEY` to your Vercel environment variables (it's already in your local `.env.local`). Without the migration the Import screen won't be able to save anything; without the key it'll tell you the AI connection isn't set up. Files you upload during an import go to private storage and are deleted once you build the workspace or discard the import.
- Changed (v0.17.0): the drop-a-file areas for bounces and stems/artwork now share one piece of plumbing with the new import screen. They look and behave exactly as before.

- Changed (v0.16.0): down to two fonts instead of three. Titles (page headings, track and project names, the logo) use Space Grotesk; everything else — body text and all the numbers (BPM, keys, timestamps, counts) — now uses Inter. Numbers won't line up in perfectly even columns anymore the way a true monospace font did, but the app reads as one consistent typeface doing two jobs instead of three competing ones.
- Added (v0.16.0): a soft glow follows your cursor around any track, project, or task you can click on — the board, Tracks, Today's attention list, project track lists, and the release track order all pick it up. It runs through the app's own ice → white → amber colours (never a random rainbow), and turns warning-orange automatically on anything blocked or overdue.
- Changed (v0.16.0): the logo in the rail is now built from the app's own light — the same moving field behind Today's hero — instead of a flat image.
- Changed (v0.16.0): hints of the animated light field now show up in more places — a thin line down the inside edge of the left rail, an echo strip along the very bottom of the app, and small lit dividers between filter rows, under column headers, and inside the track workspace's grouped tabs.

- Changed (v0.15.0): Board, Tracks, Projects and Tasks stop feeling half-empty. Tasks now lays your week out as four columns — Overdue, Today, This week, Later — instead of one narrow list, and each says something calm when it's clear rather than showing nothing. Track rows are taller with bigger artwork and now tell you what's actually next on the track (or why it's stuck) and which stage it's in. Project cards show their track and task counts as readable figures with checklist progress along the bottom, and there's a "New project" tile at the end of the grid. On the Board, when you only have a couple of tracks the cards grow so the columns don't look hollow.
- Changed (v0.15.0): the Board and Tasks filters are tidied into a single bar with the labels lined up, plus a "Clear filters" link once something is set. Card density moved out of the filters — it's a view setting, so it now sits as a small toggle beside Stages and Track. Each Board column also carries a faint tint of its stage colour, so the pipeline reads cold-to-warm from Idea through to Released, and the thin light strip is now a rounded divider inside the column header instead of a bar cut off by the rounded corners.

- Added (v0.14.0): the track page is now yours to arrange. Everything on it — the player, versions, workflow, guest links, session log, checklist, comments, files, notes, references, people, activity and details — is a module you can move. Hit "Edit layout", drag modules between the left and right columns, and hide anything you don't want. Drop one module straight onto another and they combine into a tabbed panel, so related tools share one space instead of stacking up. Drag the divider between the columns to set how wide each side is. Presets (Writing, Production, Feedback, Mix review, Release prep) each set up a focused arrangement rather than showing everything at once, and anything a preset leaves out is one click away. Your arrangement is saved per track and is yours alone — collaborators keep their own.
- Under the hood: run migration `012` in Supabase before using this. Until you do, the track page falls back to the standard layout and your changes won't stick.
- Fixed (v0.14.0): the track tools no longer sit in a cramped tab strip that hid Details, People and Activity behind a horizontal scrollbar.

- Changed (v0.13.0): a visual overhaul. TEMPO now has depth — surfaces are layered and lit rather than flat outlines, so the important things on a screen actually look important. The Today greeting is a proper hero: your active / due / session counts are large and readable at a glance, the quick actions live inside it, and the animated light field is finally visible behind it instead of hidden under a black cover. Every page opens with a bigger title and the signature flare line. Empty states and the board's drop zones look like places something goes, instead of a sentence sitting in a box.
- Changed (v0.13.0): the board no longer scrolls sideways. Stages share the width of your screen, and any stage with nothing in it shrinks to a slim labelled strip so the whole pipeline stays visible at once — start dragging and every stage opens back up so you can drop anywhere. On a phone or narrow window the stages stack vertically instead.
- Fixed (v0.13.0): artwork now shows up on the Tracks list. It was being loaded with a plain link to private storage, which never resolves, so every cover came up blank; tracks without artwork still show their colour instead.

## 2026-07-26

- Fixed (v0.12.2): collaboration features now explain themselves instead of breaking. If the database isn't set up for collaboration yet, the People panel loads empty rather than erroring, and trying to invite someone tells you to run the migrations first. Invite links that can't be opened because the server is missing its access key now show a clear "unavailable" message instead of failing silently.
- Under the hood: there's now a single `migrations/_run_all_001_to_011.sql` file you can paste into Supabase in one go, instead of running migrations 001–011 one at a time.
- Changed (v0.12.1): the animated light strip along the very top of the app is a bit taller (~14px) so you can actually see the Spectra motion running there.
- Added (v0.12.0): **Release workspace** on projects — choose General / Single / EP / Album / Edit pack; release types get date/countdown, transparent readiness, metadata & credits with copy/CSV export, distribution & pitching fields, timeline, optional release-plan preview, and a post-release section. **Track collaboration** — invite by email + role (editor / uploader / commenter / viewer), copy invite link, accept after sign-in, People + Activity tabs, in-app notification center (no email yet). **Workspace customize** — presets and module order per user. **Today & Board polish** — Needs attention queue with plain-English reasons, Board attention filters and Compact/Comfortable density.
- Under the hood: run migrations `001` through `011` in Supabase (in order) before relying on these features in production, and set `SUPABASE_SERVICE_ROLE_KEY` in Vercel / `.env.local` for guest review and invite acceptance.
- Added (v0.10.0): four big additions to the track workspace. **Milestones, decisions & blind A/B** — the version list is now a chronological timeline: pin a bounce as a milestone (with a type and label), record a decision (approved / needs changes / rejected, with an area and note — the latest shows inline, older ones log below), and see comment counts at a glance. Deleting a version now warns you if it's pinned, has comments/decisions, or is shared on an active guest link. Pick any two versions for a **blind A/B** — identities are hidden and randomly shuffled until you reveal, playback is one-at-a-time with independent volume, and you can log your pick (and optionally a decision) once revealed. **Stage recipes** — set up a stage so that moving a track into it can apply a checklist template, create a task, set the next move, change momentum, or ask for a decision; choose "preview" (pick which actions to run each time) or "automatic" (runs immediately with a toast and one-tap undo). A lightning-bolt mark on the stage timeline shows which stages have a recipe, and a "Recent automations" section on the track page shows what ran (with a retry for anything that failed). Writing/Production/Mixdown/Master/Release Prep stages get a one-click "add suggested recipe" starting point. **Focus sessions** — start one from the track page or Today with a goal and an optional handful of checklist items; it drops you into a distraction-free session screen with a live timer, the waveform, your checklist subset, and private scratch notes, and warns before you leave with unsaved notes. Ending a session asks what changed, what's left, and the next move (optionally set as the track's official next move, with a bounce upload and checklist checkoffs); abandoning discards the timer. Today now shows your total focus time this week and lets you jump back into a session still running. **References** — a new References tab on the track page holds inspiration: other tracks, images, links, or plain notes, each with an optional "why this matters" note and, for audio, a start/end clip; star any reference to carry it into your next focus session.

- Added (v0.9.0): guest review links — share a bounce with someone outside TEMPO without giving them an account. From the track page, create a link to one fixed version (comments on / download off by default, 14-day expiry), copy the one-time URL, and see it listed as active, expired, or revoked (revoke anytime, without deleting comments already left). The guest opens a focused, branded page — title, artwork, that one version's waveform, and a comment box (name + note, optionally pinned to a moment) — with no sign-in, no access to your notes/checklist/other versions, and the page kept out of search engines.
- Added (v0.8.0): timestamped comments on the waveform. Pin a note to the exact moment in a bounce — "Add comment here" while listening, or click a marker on the waveform — reply, resolve/reopen, edit, or delete (with confirm) from a new Comments tab on the track page, which shows how many are still open. Switch between "this version" and "all versions"; clicking an older comment jumps to (and loads) the right bounce and moment. Deleting a version now tells you how many comments go with it before you confirm.
- Under the hood (v0.7.1): built the data-layer plumbing for a batch of upcoming features — timestamped comments, guest review links, version decisions/milestones, stage recipes (auto-checklist/task setup when a track changes stage), focus sessions, reference tracks, collaborator invites, activity + notifications, workspace layout preferences, and release metadata. Nothing in the app looks or behaves differently yet — none of this is wired into a screen — it's the groundwork the next feature updates will build on.
- Added (v0.7.0): the track page got a redesign into a proper studio workspace — an artwork-tinted identity header, a horizontal stage timeline you click (or arrow-key) through, and your tools (Work checklist, Files, Notes, Details) live in a tab panel that remembers its state when you switch tabs and can be deep-linked (e.g. jump straight to Files). Jumping more than one stage at once asks you to confirm first.
- Added: a Now / Next / Blocked / Target strip under the player — set your next move and its due date, note who you're waiting on, flag a blocker, and see your target date, all editable right there. Underneath, a short plain-English list explains anything that needs attention (blocked, next move overdue, deadline soon, quiet for a week+, stuck in a stage for two weeks+), with a way to see all of it if there's more than a couple of flags.
- Added: Board cards now show a "Next:" line when a track has a next move set, plus a small warning mark when a track is blocked or its next move is overdue.
- Changed: "Delete track" moved from the bottom of the track page into the Details tab.
- Under the hood: run migration 001 (`001_track_workflow.sql`) in Supabase — until then the new next-move/blocked/waiting-on/target fields safely stay blank instead of breaking the page.
- Added (v0.6.10): next-generation product and technical specifications for upcoming TEMPO work (track workspace redesign, feedback links, milestones, focus mode, collaboration, and more). No user-facing behavior changed in this update — planning docs only.
- Added (v0.6.9): a Create account screen at `/register` (email + password), with a link from Sign in.
- Changed (v0.6.8): sign-in is email + password now (no magic-link emails), so you won’t hit Supabase’s tiny free email rate limit while testing.
- Fixed (v0.6.7): wav→mp3 converter loads from the app itself (not a flaky CDN), so localhost conversion works; if conversion still fails, TEMPO uploads the original bounce when it’s under 200 MB.
- Added (v0.6.6): wav and aiff bounces are automatically converted to mp3 in your browser before upload (320 kbps) so big studio exports fit under cloud size limits — you’ll see “Converting…” then “Uploading…”.
- Fixed: production magic-link sign-in no longer sends you to localhost — the live app always redirects to https://tempo-ten-sigma.vercel.app (local still uses localhost when you sign in there).
- Fixed: Vercel build failure from the shader / Three.js types.
- Changed (v0.6.5): each track keeps only the **latest 2** bounces — uploading a third removes the oldest so storage stays lean (you can still A/B the two you have).
- Fixed (v0.6.4): artwork / file names with spaces no longer fail upload (“Invalid key”); bounce size errors now explain the real limit (your Supabase Storage setting, often 50 MB by default).
- Added: tap the track’s cover square to upload cover art (also still works from Stems & assets → Artwork).
- Under the hood: to allow ~80–200 MB wavs, open Supabase → Storage → Settings and raise “Global file size limit” to at least 200 MB (TEMPO already allows up to 200 MB on the client).

- Fixed (v0.6.3): Today / Board no longer crash with “Cannot find module three.js” — the shader loads only in the browser and the Next cache is cleared on the next local start.
- Fixed (v0.6.2): local launcher finds Node when started from Finder (loads your usual PATH / Homebrew).
- Added (v0.6.1): double-click **Launch TEMPO.command** in the project folder to start a local copy and open it in your browser (leave the Terminal window open while you work; Ctrl+C stops it).

- Added (v0.6.0): upload audio versions (mp3 / wav / aiff / m4a, max 200 MB) with a “what changed?” note; each bounce is numbered and marked current; play, set current, download, or delete with confirm.
- Added: waveform player on the track page — play/pause, elapsed/total, and a version dropdown to A/B older bounces.
- Added: stems & assets upload by kind (stem, MIDI, artwork, lyrics, reference, other); artwork uploads set the track thumbnail; download and delete.
- Added: session log on each track — one-field composer, reverse-chron list, optional link to today’s upload.
- Added: Tasks page with quick-add, category/status filters, and groups Overdue / Today / This week / Later; linked tracks and projects deep-link as chips.
- Added: Projects — card grid with deadline, member counts, and checklist %; detail page to attach/detach tracks and tasks.
- Added: Today is the home screen after sign-in — greeting banner with active tracks / due this week / sessions this week, Tasks due, In motion (Active tracks), and quick actions (+ Track, + Task, Log session).
- Added: Spectra shader moments — brief intro behind the TEMPO wordmark (once per session), thin animated top edge on desktop, and shader empty states on Board and Today; respects reduced motion and pauses when the tab is hidden.
- Added: installable PWA (dark theme), clearer focus rings, loading skeletons, and error toasts.
- Changed: track artwork thumbnails load through signed links from private storage.

- Added (v0.3.0): open any track into its own workspace page — edit the title inline, set momentum / stage / deadline, and see BPM, key, version count, and type at a glance.
- Added: per-track checklist with add, edit, toggle, drag-reorder, and delete; thin ice→amber progress bar; apply a template or save the current list as a new template.
- Added: four built-in checklist templates on first sign-in — Arrangement, Mixdown, Master Prep, and Release Prep.
- Added: freeform notes that save as you type, plus a details panel for artist alias, type, BPM, key, genre, destination, and tags.
- Changed: tapping a track on the board or in the Tracks list opens the track workspace instead of the edit modal.

- Added (v0.2.0): version number under Settings in the left rail so you can see which build you’re on.
- Added: Spaces — on first login you get Originals and Edits & Remixes with default stages; switch spaces from the rail; create, rename, reorder, and delete spaces in Settings.
- Added: Stage editor on the board — add, rename, drag-reorder, and delete stages; if a stage has tracks, you pick where they move.
- Added: Kanban board for the active space — drag tracks between stages, filter by type and tag, empty-state invite when there’s nothing yet.
- Added: Create / edit tracks (title + type required; more details optional); park or delete with confirm; Tracks list for the active space.
- Changed: phone Add button opens a new track on the board.
- Added: TEMPO is live on the web at https://tempo-ten-sigma.vercel.app — sign in with a magic link (email, no password) and sign out from Settings.
- Added: the dark studio app shell with navigation for Today, Board, Tracks, Projects, Tasks, and Settings (desktop side rail; phone bottom tabs).
- Added: living product docs (this changelog and the product overview) so the musician owner can see what exists today.
- Under the hood: cloud database and private audio storage are provisioned; no migration to run for this update.

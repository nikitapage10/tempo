import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy · TEMPO",
  description: "How TEMPO handles your account and studio data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated={LEGAL_LAST_UPDATED}>
      <p>
        This policy explains what TEMPO collects, why it is needed, how it is
        handled, and the choices you have. TEMPO is operated by Nikita Page.
        Contact: <a href="mailto:connect@nikita.page">connect@nikita.page</a>.
      </p>

      <div className="rounded-panel border border-ice/25 bg-ice/5 p-5 text-text-hi">
        <p className="font-display text-base font-semibold">Private means private</p>
        <p className="mt-2 text-sm leading-6 text-text-lo">
          Your private tracks, audio, lyrics, notes, files, messages, and
          workspace content are stored on TEMPO’s backend so the product can
          work for you. Nikita and TEMPO administrators do not routinely browse
          that content, and the admin portal is designed not to expose it. We do
          not sell it, use it for advertising, or use it to train TEMPO or
          general-purpose AI models.
        </p>
      </div>

      <h2>1. What this policy covers</h2>
      <p>
        This policy covers TEMPO’s websites, app, private workspaces, artist
        profiles, Scenes, support, and related services. It does not control a
        third-party site or service you choose to visit or connect.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li>
          <strong>Account information</strong> — email address, authentication
          provider, sign-in and account timestamps, invite status, and your
          acceptance of these policies. Authentication providers handle your
          password or provider credentials; TEMPO does not display them.
        </li>
        <li>
          <strong>Private studio content</strong> — track and project details,
          audio, lyrics, notes, tasks, checklists, sessions, calendar entries,
          references, private messages, collaborators, and files you add.
        </li>
        <li>
          <strong>Profile and community content</strong> — artist or member
          identity, location you choose to provide, profile details, follows,
          posts, comments, events, groups, and Scene participation. You choose
          what to publish and which communities to join.
        </li>
        <li>
          <strong>Connected-platform information</strong> — profile links,
          public catalog and audience statistics, artwork, and identifiers from
          music services you ask TEMPO to connect or look up.
        </li>
        <li>
          <strong>Feature inputs</strong> — prompts, attachments, screenshots,
          documents, or voice recordings you deliberately submit to Import,
          Assistant, transcription, or another assisted feature.
        </li>
        <li>
          <strong>Usage, support, and technical information</strong> — feature
          counts, storage totals, sign-in activity, notifications, reports you
          submit, the page where you requested support, browser information,
          and ordinary hosting and security logs such as IP address and request
          time.
        </li>
      </ul>

      <h2>3. Where information comes from</h2>
      <p>
        Most information comes directly from you. Some comes from people you
        collaborate with, identity providers you choose, public music-platform
        APIs, and the device or browser used to reach TEMPO. We do not infer a
        precise physical location; profile locations are optional text you
        provide.
      </p>

      <h2>4. How we use information</h2>
      <ul>
        <li>Authenticate you and keep accounts and sharing links secure.</li>
        <li>
          Store, organize, play, back up, and sync the workspace you ask us to
          provide.
        </li>
        <li>
          Enable collaboration, messages, profiles, Scenes, and notifications
          according to the visibility and sharing choices you make.
        </li>
        <li>
          Run an AI or transcription feature when you choose to use it and
          return the requested result.
        </li>
        <li>
          Provide support, investigate abuse or security issues, enforce our
          Terms, and meet legal obligations.
        </li>
        <li>
          Understand product health through aggregate counts such as requests,
          uploads, storage, and feature usage—not by reading private creative
          work in the admin portal.
        </li>
      </ul>

      <h2>5. When a person may access private content</h2>
      <p>
        TEMPO is built so routine administration does not require opening your
        private creative work. Human access may occur only when reasonably
        necessary: when you explicitly share content or ask for support that
        requires it; to investigate a specific security, abuse, or reliability
        incident; to recover or protect the Service; or when legally required.
        Access should be limited to what is necessary for that purpose. Automated
        systems still process and back up content to operate the features you
        use.
      </p>

      <h2>6. AI and transcription features</h2>
      <p>
        TEMPO sends information to an AI provider only when you choose a feature
        that needs it. That may include what you typed or uploaded and the
        relevant workspace context needed to answer. TEMPO currently uses
        OpenAI for these features. TEMPO does not use private workspace content
        to train TEMPO or general-purpose AI models. Avoid submitting secrets
        that are not needed for the result, and remove a source before processing
        if you do not want it sent.
      </p>

      <h2>7. How information is shared</h2>
      <p>We disclose information only in these circumstances:</p>
      <ul>
        <li>
          <strong>At your direction</strong> — to collaborators, guest reviewers,
          profile visitors, Scene members, or the public, based on the access and
          visibility settings you choose.
        </li>
        <li>
          <strong>Service providers</strong> — companies that provide hosting,
          database, authentication, private file storage, email delivery, and AI
          processing. These currently include Supabase, Vercel, Resend, OpenAI,
          and any identity provider you select.
        </li>
        <li>
          <strong>Connected platforms</strong> — music services such as Spotify,
          SoundCloud, or Apple Music when you ask TEMPO to retrieve or connect
          information.
        </li>
        <li>
          <strong>Safety and legal reasons</strong> — when we reasonably believe
          disclosure is required by law or necessary to protect members, rights,
          security, or the Service.
        </li>
        <li>
          <strong>Business changes</strong> — if TEMPO is involved in a merger,
          financing, acquisition, reorganization, or sale, subject to appropriate
          confidentiality and notice where required.
        </li>
      </ul>
      <p>
        We do not sell personal information or private creative content. We do
        not share it for cross-context behavioral advertising or targeted ads.
      </p>

      <h2>8. Cookies and local storage</h2>
      <p>
        TEMPO uses essential cookies and browser storage for sign-in, security,
        saved preferences, playback, onboarding progress, and other features you
        request. TEMPO does not use third-party advertising cookies.
      </p>

      <h2>9. Retention and deletion</h2>
      <p>
        We keep account and workspace information while your account is active
        and as reasonably needed to provide the Service. Deleting your account
        removes account-tied production data. Limited copies may remain for a
        reasonable period in protected backups, security logs, audit records, or
        where law requires retention, after which they are deleted or
        de-identified. Content another person independently posted or is legally
        required to retain may not disappear with your account.
      </p>
      <p>
        You can export catalog metadata from Settings → Catalog → Your data.
        That export does not include audio, so keep masters and DAW projects in
        your own archive.
      </p>

      <h2>10. Security</h2>
      <p>
        TEMPO uses access controls, private file storage, time-limited file links,
        established hosting providers, and other administrative and technical
        safeguards designed for the information it handles. No online system is
        risk-free. Protect your password, review collaborators, and treat guest
        links as sensitive.
      </p>

      <h2>11. Your choices and rights</h2>
      <ul>
        <li>Update your email or password in Settings → Account.</li>
        <li>Control profile, message, Scene, and sharing visibility.</li>
        <li>Export catalog metadata and keep your own copies of files.</li>
        <li>Delete your account in Settings → Account.</li>
        <li>
          Ask to access, correct, or delete personal information by emailing us.
          Depending on where you live, you may have additional privacy rights and
          a right to appeal a denied request.
        </li>
      </ul>
      <p>
        We may need to verify your identity before completing a request. We will
        not discriminate against you for exercising a privacy right.
      </p>

      <h2>12. International processing</h2>
      <p>
        TEMPO and its providers may process information in the United States and
        other countries. Those places may have different data-protection rules
        from where you live.
      </p>

      <h2>13. Children</h2>
      <p>
        TEMPO is not directed to children under 16, and they may not create an
        account. If you believe a child provided personal information, contact
        us so we can take appropriate steps.
      </p>

      <h2>14. Changes and contact</h2>
      <p>
        We will update this page when our practices change. For material changes,
        we will provide notice in the Service and ask members to acknowledge the
        new version when appropriate. Privacy questions or requests can be sent
        to <a href="mailto:connect@nikita.page">connect@nikita.page</a>. See also
        our <a href="/terms">Terms of use</a>.
      </p>
    </LegalShell>
  );
}

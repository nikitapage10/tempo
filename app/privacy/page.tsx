import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy policy · TEMPO",
  description: "How TEMPO handles your account and studio data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated="August 2, 2026">
      <p>
        This policy explains what TEMPO collects, why, and how we handle it.
        TEMPO is a music project workspace for an invited program.
      </p>

      <h2>1. Who we are</h2>
      <p>
        TEMPO is operated by Nikita Page. Contact:{" "}
        <a href="mailto:connect@nikita.page">connect@nikita.page</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email, authentication details (and
          provider identity if you use Google, Apple, or Microsoft when those
          are enabled), and basic account timestamps.
        </li>
        <li>
          <strong>Studio content you create</strong> — track titles, notes,
          projects, tasks, checklists, sessions, calendar items, messages you
          send, and similar workspace text.
        </li>
        <li>
          <strong>Files you upload</strong> — audio bounces, artwork, and other
          assets you put in TEMPO. These live in private storage and are served
          through short-lived signed links.
        </li>
        <li>
          <strong>Usage &amp; support</strong> — things like when you sign in,
          in-app notifications, optional bug/help reports you submit, and
          assistant usage limits needed to run the product.
        </li>
        <li>
          <strong>Technical data</strong> — browser or device basics included
          when you send a support report, and normal server logs for security.
        </li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To run your workspace (save, play back, collaborate, notify).</li>
        <li>To authenticate you and keep the service secure.</li>
        <li>To respond to support requests you send.</li>
        <li>
          To operate program administration (invites, abuse handling) without
          browsing private catalog contents through the Admin console.
        </li>
      </ul>
      <p>We don’t sell your personal data or your music.</p>

      <h2>4. Sharing</h2>
      <p>We share data only as needed to run TEMPO, for example:</p>
      <ul>
        <li>
          <strong>Infrastructure providers</strong> such as Supabase (database,
          auth, storage) and Vercel (hosting), under their respective terms.
        </li>
        <li>
          <strong>People you invite</strong> — collaborators and guest
          reviewers see only what that invite or link allows.
        </li>
        <li>
          <strong>AI features you use</strong> — Import and related assistants
          may send content you provide to our AI provider solely to generate the
          feature’s result. Don’t paste secrets you wouldn’t want processed.
        </li>
        <li>
          When required by law, or to protect the service and its members from
          abuse.
        </li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        We keep your account and catalog while your account is active. If you
        delete your account from Settings → Account, we remove account-tied
        data subject to normal backup windows and security logs. You can export
        catalog metadata anytime from Settings → Catalog → Your data (audio
        files are not included in that export — keep masters in your own
        archives).
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard hosting, private file storage, and
        access controls. No system is perfect — protect your password and treat
        guest links as sensitive.
      </p>

      <h2>7. Your choices</h2>
      <ul>
        <li>Update email or password in Settings → Account.</li>
        <li>Export catalog metadata or restore from snapshots.</li>
        <li>Delete your account (typed email confirmation).</li>
        <li>
          Control profile visibility and who can message you on the Artist page.
        </li>
      </ul>

      <h2>8. Children</h2>
      <p>
        TEMPO isn’t directed at children under 16. If you believe a minor’s
        data was provided, contact us and we’ll take appropriate steps.
      </p>

      <h2>9. Changes</h2>
      <p>
        We’ll update this page when our practices change. The “Last updated”
        date shows the latest version.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href="mailto:connect@nikita.page">connect@nikita.page</a>. See also
        our <a href="/terms">Terms of use</a>.
      </p>
    </LegalShell>
  );
}

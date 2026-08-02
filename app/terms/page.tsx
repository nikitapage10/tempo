import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms of use · TEMPO",
  description: "Terms of use for the TEMPO music project workspace.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of use" updated="August 2, 2026">
      <p>
        These terms cover your use of TEMPO (the “service”), a music project
        workspace operated for an invited program. By creating an account or
        using TEMPO, you agree to them. If you don’t agree, don’t use the
        service.
      </p>

      <h2>1. The service</h2>
      <p>
        TEMPO helps you organize tracks, projects, tasks, sessions, and related
        studio work. Features may change as the product develops. Access is by
        invitation unless we say otherwise.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You’re responsible for keeping your sign-in details safe.</li>
        <li>
          Provide accurate information and use TEMPO only for lawful creative
          and project work.
        </li>
        <li>
          You’re responsible for content you upload or type (audio, notes,
          images, messages, and similar).
        </li>
        <li>
          Don’t attempt to break into other accounts, scrape private data, or
          disrupt the service.
        </li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You keep ownership of your music and materials. You grant us a limited
        license to store, process, and display that content only as needed to
        run TEMPO for you (playback, collaboration you enable, backups we
        operate, and similar). We don’t claim your songs.
      </p>

      <h2>4. Collaboration &amp; guests</h2>
      <p>
        If you invite collaborators or share guest review links, you’re
        choosing who can see or comment on that work. Revoke access when you no
        longer want someone in. Guest reviewers don’t get a full TEMPO account
        unless they register separately.
      </p>

      <h2>5. Acceptable use</h2>
      <ul>
        <li>No illegal content, harassment, or spam.</li>
        <li>No uploading malware or attempting to reverse-engineer private systems.</li>
        <li>
          No using TEMPO to infringe someone else’s copyright or other rights.
        </li>
      </ul>

      <h2>6. Availability</h2>
      <p>
        We aim for a reliable workspace but don’t guarantee uninterrupted
        uptime. Plan critical releases with your own archives (DAW projects and
        masters) outside TEMPO.
      </p>

      <h2>7. Suspension &amp; deletion</h2>
      <p>
        We may suspend or remove accounts that break these terms or put the
        program at risk. You may delete your account from Settings → Account.
        Deletion removes account-tied data according to our{" "}
        <a href="/privacy">Privacy policy</a>; some operational logs may remain
        for a limited time where required for security.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        TEMPO is provided “as is” for this stage of the product. To the fullest
        extent allowed by law, we’re not liable for lost files, missed release
        dates, or indirect damages arising from use of the service. Keep
        masters and project backups you care about in your own storage.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. Continued use after a posted update means you
        accept the new terms. Material changes will be reflected by the “Last
        updated” date on this page.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:connect@nikita.page">connect@nikita.page</a>.
      </p>
    </LegalShell>
  );
}

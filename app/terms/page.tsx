import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of use · TEMPO",
  description: "Terms of use for the TEMPO music project workspace.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of use" updated={LEGAL_LAST_UPDATED}>
      <p>
        These Terms of use (the “Terms”) are an agreement between you and
        Nikita Page, the operator of TEMPO (“TEMPO,” “we,” “us,” or “our”).
        They cover your access to and use of TEMPO’s websites, apps, features,
        and related services (the “Service”). By creating an account, clicking
        “Agree and continue,” or using the Service, you agree to these Terms.
        If you do not agree, do not use the Service.
      </p>

      <h2>1. Who may use TEMPO</h2>
      <p>
        You must be at least 16 and able to enter a binding agreement where you
        live. Access is currently invitation-only. Your invitation and account
        are personal to you unless we expressly approve a team arrangement.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Give us accurate information and keep it current.</li>
        <li>Keep sign-in details and guest links secure.</li>
        <li>
          Tell us promptly if you believe your account or a sharing link has
          been compromised.
        </li>
        <li>
          You are responsible for activity through your account and for the
          people with whom you choose to share access.
        </li>
      </ul>

      <h2>3. Your music and content stay yours</h2>
      <p>
        You retain ownership of music, recordings, lyrics, artwork, notes,
        messages, files, and other material you submit to TEMPO (“Your
        Content”). You give us a limited, non-exclusive license to host, copy,
        process, transmit, and display Your Content only as reasonably needed
        to operate the features you use—for example, private storage, playback,
        backups, collaboration you enable, and an AI feature you deliberately
        invoke. This license ends when Your Content is deleted, except for
        temporary backup copies and material we must retain for security or
        legal reasons.
      </p>
      <p>
        TEMPO does not claim your songs, sell your private content, use it for
        advertising, or use it to train TEMPO or general-purpose AI models.
        Our <a href="/privacy">Privacy policy</a> explains the narrow situations
        in which systems or people may process content to provide the Service.
      </p>

      <h2>4. You need rights to what you add</h2>
      <p>
        You represent that you have the rights and permissions needed to add
        Your Content and to share it with collaborators, guests, or communities
        you choose. Do not upload material that infringes copyright, privacy,
        publicity, confidentiality, or other rights. If you believe material in
        TEMPO infringes your rights, contact us at the address below.
      </p>

      <h2>5. TEMPO’s product and intellectual property</h2>
      <p>
        The Service—including its software, design, visual system, workflows,
        text, brand, documentation, and non-user-created content—is owned by
        TEMPO and its licensors and is protected by intellectual-property and
        other laws. Subject to these Terms, we give you a limited, revocable,
        non-exclusive, non-transferable right to use the Service for your own
        creative and project work. No ownership in the Service transfers to
        you.
      </p>

      <h2>6. No copying, competitive misuse, or resale</h2>
      <p>You may not, and may not help anyone else to:</p>
      <ul>
        <li>
          copy, reproduce, modify, translate, mirror, or create derivative works
          from the Service or its non-user-created materials;
        </li>
        <li>
          reverse engineer, decompile, disassemble, probe, or attempt to obtain
          source code, underlying models, private APIs, or nonpublic systems,
          except where applicable law does not allow this restriction;
        </li>
        <li>
          use access to TEMPO, its nonpublic features, confidential information,
          or materials to clone the product or develop, train, benchmark, or
          improve a competing product or service;
        </li>
        <li>
          sell, sublicense, rent, white-label, timeshare, or commercially
          exploit access to the Service;
        </li>
        <li>
          scrape, harvest, or systematically extract product data, member data,
          community data, or content;
        </li>
        <li>
          remove or obscure copyright, trademark, or ownership notices.
        </li>
      </ul>
      <p>
        This section protects TEMPO’s product and nonpublic know-how; it does not
        prevent you from making music, operating your own creative business, or
        using skills and ideas you developed independently.
      </p>

      <h2>7. Invited and prerelease access</h2>
      <p>
        Some features may be private, experimental, or shared before public
        release. You may talk honestly about your experience, but you may not
        publish nonpublic product materials, private screenshots, access
        credentials, technical details, or confidential information we identify
        as private without permission. Feedback is voluntary. If you send us
        product ideas or feedback, you allow us to use it without restriction or
        payment, but that never gives us rights to your music or private studio
        content.
      </p>

      <h2>8. Acceptable use</h2>
      <ul>
        <li>No illegal activity, harassment, threats, spam, or impersonation.</li>
        <li>No malware, security attacks, unauthorized access, or disruption.</li>
        <li>No bypassing access, rate, sharing, or safety controls.</li>
        <li>
          No collecting another member’s personal information without a lawful
          reason and their permission.
        </li>
        <li>No use that infringes or misappropriates another person’s rights.</li>
      </ul>

      <h2>9. Sharing, communities, and third-party services</h2>
      <p>
        You control the collaborators, guest reviewers, and communities with
        whom you share. Content you post to a public profile or public Scene may
        be visible outside your private workspace. TEMPO may link to or interact
        with third-party services such as identity providers and music
        platforms. Their terms and privacy practices govern their services, and
        we are not responsible for them.
      </p>

      <h2>10. Availability and backups</h2>
      <p>
        TEMPO is evolving and may change, pause, or discontinue features. We aim
        for a reliable Service but do not guarantee uninterrupted access or that
        every feature will remain available. Keep independent copies of masters,
        DAW projects, and other irreplaceable files. TEMPO is a workspace, not
        your sole archive.
      </p>

      <h2>11. Suspension and ending use</h2>
      <p>
        You may stop using TEMPO or delete your account from Settings. We may
        suspend or end access when we reasonably believe these Terms were
        violated, an account creates risk for members or the Service, or we are
        required to do so by law. Sections that by their nature should survive
        termination—including ownership, restrictions, disclaimers, and
        liability terms—continue to apply.
      </p>

      <h2>12. Disclaimers and responsibility</h2>
      <p>
        To the fullest extent permitted by law, the Service is provided “as is”
        and “as available,” without warranties of merchantability, fitness for a
        particular purpose, non-infringement, or uninterrupted operation. TEMPO
        is not responsible for lost files, missed deadlines, business losses,
        or indirect, incidental, special, consequential, or punitive damages.
        Where liability cannot be excluded, our total liability relating to the
        Service will not exceed the greater of US $100 or the amount you paid us
        for the Service in the 12 months before the claim. Some jurisdictions do
        not allow all of these limits, so they apply only to the extent allowed.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms as TEMPO changes. We will update the date on
        this page and, for material changes, ask you to accept the new version
        before continuing to use the private Service. Changes do not apply
        retroactively.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions, legal notices, or copyright concerns: {" "}
        <a href="mailto:connect@nikita.page">connect@nikita.page</a>.
      </p>
    </LegalShell>
  );
}

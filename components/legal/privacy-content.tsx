import React from "react";
import { LegalPageLayout, LegalSection } from "./legal-page-layout";

export function PrivacyContent() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      effectiveDate="Effective June 1, 2026"
      lede={
        <p>
          Atmosphere Mail LLC operates the relay and webmail infrastructure. Here is exactly what we collect, why, and for how long.
        </p>
      }
    >
      <LegalSection marker="§1 · What we collect" title="The data we hold">
        <ul className="bullets">
          <li><strong>Your DID</strong> and registered sending domain(s).</li>
          <li>
            <strong>A salted hash of your API key</strong>. The plaintext key is only shown once, at enrollment.
          </li>
          <li>
            <strong>DKIM keypairs</strong> issued to your domain. Private keys are stored encrypted at rest and never leave our servers.
          </li>
          <li>
            <strong>Send logs</strong>: per-message sender DID, recipient address, From/To headers, timestamps, delivery status code, and
            bounce disposition. We do <em>not</em> store message bodies after handoff to the queue.
          </li>
          <li>
            <strong>Rate-limit counters</strong>: short-window send counts per DID used to enforce hourly and daily limits.
          </li>
          <li>
            <strong>Bounce records</strong>: inbound DSN classifications per DID so we can suspend senders with pathological bounce rates.
          </li>
          <li>
            <strong>Suppression list</strong>: recipients who used the one-click unsubscribe header, keyed per sender DID.
          </li>
          <li>
            <strong>IP addresses</strong> of SMTP clients, kept only in transient logs for abuse investigation and rotated out under the
            retention schedule below.
          </li>
        </ul>
      </LegalSection>

      <LegalSection marker="§2 · What we do not collect" title="Data we deliberately avoid">
        <p>
          We do not retain full message bodies past delivery. We do not set web tracking cookies, fingerprint browsers, or embed
          third-party analytics on any of our pages. We do not sell or rent member data to anyone, under any circumstances.
        </p>
      </LegalSection>

      <LegalSection marker="§3 · Retention" title="How long we keep it">
        <ul className="bullets">
          <li><strong>Terminal message logs</strong> (sent, bounced): 30 days, then purged.</li>
          <li><strong>Rate-limit counters</strong>: 48 hours rolling window.</li>
          <li><strong>Suppression entries</strong>: for the life of the member record. Unsubscribes must persist.</li>
          <li>
            <strong>Member record</strong>: indefinite while active. After a deletion request, a 14-day reactivatable cooldown, then
            anonymized hard delete. The contact email is kept an additional 30 days so the export link in the deletion-confirmation
            email keeps working.
          </li>
        </ul>
      </LegalSection>

      <LegalSection marker="§4 · Sharing" title="Who else sees this">
        <p>
          We publish a small set of <strong>public atproto labels</strong> about your DID via our cooperative labeler at{" "}
          <code>labeler.atmos.email</code>. Today that&apos;s <code>verified-mail-operator</code> and <code>relay-member</code>. These
          are signed, network-visible, and any atproto consumer can read them. That&apos;s the point: third parties can verify
          you&apos;re a cooperative member.
        </p>
        <p>
          Send events and bounce outcomes also feed our internal trust and safety systems, which derive operational reputation signals
          used to drive throttling, warming, and enforcement. Those signals stay inside the relay. They are not published as atproto
          labels and do not leave our infrastructure.
        </p>
        <p>
          We do not share message content, recipient lists, or API keys with anyone.
        </p>
        <p>
          <strong>Where the data lives.</strong> The relay and webmail are operated by Atmosphere Mail LLC on cloud hosting in the
          United States. If you write to us from the European Economic Area, the United Kingdom, or another jurisdiction with
          cross-border data protection rules, your data is processed in the US. We act as a controller for all data we hold about you
          and collect it directly from you. There is no intermediate processor.
        </p>
        <p>
          You provide your data directly to us as the controller, on your own initiative. EDPB Guidelines 05/2021 treat that as
          outside the Chapter V &ldquo;transfer&rdquo; regime. We remain subject to GDPR as a controller targeting EEA and UK
          residents, and every right in this notice applies.
        </p>
      </LegalSection>

      <LegalSection marker="§5 · Why we're allowed to process this" title="Legal basis">
        <p>Under GDPR Article 6, we rely on the following lawful bases:</p>
        <ul className="bullets">
          <li>
            <strong>Performance of a contract</strong> (Art. 6(1)(b)) for the data we need to operate the relay and webmail you signed
            up to use: your DID, API key hash, DKIM keys, enrolled domains, send and bounce logs, suppression entries, and rate-limit
            counters.
          </li>
          <li>
            <strong>Legitimate interests</strong> (Art. 6(1)(f)) for the reputation signals we publish via the cooperative labeler and
            for the internal trust-and-safety detections that drive throttling and suspension. Our interest is keeping the service
            deliverable for every member; that interest is balanced against your right to a fair, transparent reputation system.
          </li>
          <li>
            <strong>Legal obligation</strong> (Art. 6(1)(c)) for the minimum records we must keep to respond to abuse complaints,
            lawful government requests, and our own breach-notification duties.
          </li>
        </ul>
        <p>
          We do not rely on consent as a lawful basis for the operational data above, because withdrawing it would prevent us from
          running the service you asked for. Your right to delete (§6) is the equivalent control.
        </p>
      </LegalSection>

      <LegalSection marker="§6 · Your rights" title="Access, correction, deletion, objection, complaint">
        <p>
          You have full rights over your data under applicable data protection laws (including GDPR and CCPA/CPRA). If you wish to
          request access, correction, export, or complete deletion of the personal data we hold about you, email{" "}
          <a href="mailto:postmaster@atmos.email">postmaster@atmos.email</a> from a mailbox you can prove control of, or sign the
          request with your DID&apos;s signing key. We process requests within 30 days in line with Art. 12(3).
        </p>
        <ul className="bullets">
          <li><strong>Rectification</strong> (Art. 16): ask us to correct inaccurate data we hold about you.</li>
          <li><strong>Erasure &amp; Deletion</strong> (Art. 17): ask us to permanently delete your account and associated records.</li>
          <li><strong>Restriction</strong> (Art. 18): ask us to pause processing while a dispute is resolved.</li>
          <li><strong>Data Portability</strong> (Art. 20): request a machine-readable export of your personal data.</li>
          <li>
            <strong>Objection</strong> (Art. 21): you may object at any time to processing based on our legitimate interests. When
            you object, we will stop processing unless we can demonstrate compelling legitimate grounds.
          </li>
          <li>
            <strong>Complaint to a supervisory authority</strong> (Art. 77): if you believe we have mishandled your data, you can
            lodge a complaint with the data-protection regulator in your country of residence (e.g. CNIL in France, BfDI in Germany,
            or the ICO in the UK).
          </li>
        </ul>
      </LegalSection>

      <LegalSection marker="§7 · Automated decisions" title="How throttling and suspension work">
        <p>
          We run automated systems that can throttle or suspend sending accounts without a human in the loop on every event. They look
          at metrics such as sending rate, bounce frequency, and spam complaints. If a threshold is crossed, sending can be slowed or
          stopped.
        </p>
        <p>
          Protecting the deliverability of the relay&apos;s IP pool is essential to the service. You can request human review by
          emailing <a href="mailto:postmaster@atmos.email">postmaster@atmos.email</a>, explain your situation, and contest any automated
          decision.
        </p>
      </LegalSection>

      <LegalSection marker="§8 · Security" title="How we protect it">
        <p>
          Sensitive fields (API keys, your contact email, and the cryptographic keys we use to sign mail on your behalf) are encrypted
          at rest using industry-standard methods. Host access is restricted to the operations team and uses hardware-keyed SSH.
        </p>
        <p>
          If we discover a personal-data breach that is likely to result in a risk to your rights and freedoms (Art. 33), we will
          notify the relevant supervisory authority within 72 hours of becoming aware of it, and notify affected users directly
          without undue delay (Art. 34).
        </p>
      </LegalSection>

      <LegalSection marker="§9 · Google User Data & Workspace Integrations" title="Google API Services User Data Policy Compliance">
        <p>
          Comail supports optional integration with Google Workspace and Google OAuth to allow users to sign in, connect their email
          accounts, and synchronize workspace data directly within the Comail client.
        </p>
        <p>
          <strong>Google API Data Usage and Scopes:</strong> When you connect your Google account, Comail requests only the minimum
          scopes necessary to fulfill the features you explicitly choose to use (such as authenticating your identity via Google Sign-In
          and accessing email or calendar items you choose to view or send).
        </p>
        <ul className="bullets">
          <li>
            <strong>No Transfer for Advertising:</strong> We do NOT sell your Google user data. We do NOT share or transfer Google user
            data to third parties for serving advertisements, including retargeted, personalized, or interest-based advertising.
          </li>
          <li>
            <strong>No Model Training:</strong> We do NOT use Google user data to train, retrain, or fine-tune generalized artificial
            intelligence (AI) or machine learning (ML) models.
          </li>
          <li>
            <strong>Limited Human Access:</strong> Human access to Google user data is strictly prohibited unless: (a) you have provided
            explicit affirmative consent for troubleshooting a specific issue, (b) it is required for security purposes (such as
            investigating abuse), or (c) it is necessary to comply with applicable laws.
          </li>
          <li>
            <strong>Limited Use Disclosure:</strong> Comail&apos;s use and transfer to any other app of information received from Google
            APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </li>
        </ul>
      </LegalSection>

      <LegalSection marker="§10 · Contact" title="Reach us">
        <p>
          The data controller is <strong>Atmosphere Mail LLC</strong>, a Washington State limited liability company. Operational
          contact for privacy and security matters:{" "}
          <a href="mailto:postmaster@atmos.email">postmaster@atmos.email</a>.
        </p>
        <p>
          For abuse reports, contact <a href="mailto:abuse@atmos.email">abuse@atmos.email</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

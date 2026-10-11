import React from "react";
import Link from "next/link";
import { LegalPageLayout, LegalSection } from "./legal-page-layout";

export function TermsContent() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      effectiveDate="Effective May 22, 2026"
      lede={
        <p>
          By enrolling a DID and sending mail through the comail relay, you agree to these terms.
        </p>
      }
    >
      <LegalSection marker="§1 · The service" title="What this is">
        <p>
          comail is a cooperative SMTP submission relay operated by{" "}
          <strong>Atmosphere Mail LLC</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;). It accepts authenticated mail from
          members whose identity is verified via atproto DIDs, signs outbound mail with DKIM, and delivers it to recipient MTAs.
          The service is currently free during alpha and provided on a best-effort basis. Paid tiers will be introduced with at least
          30 days&apos; notice; a free tier will remain available for low-volume senders.
        </p>
      </LegalSection>

      <LegalSection marker="§2 · Your account" title="Eligibility and authentication">
        <p>
          To enroll you must prove control of both a DID and the domain you intend to send from. We verify domain ownership
          via a DNS TXT record, the same primitive Let&apos;s Encrypt uses. You are responsible for safeguarding the API key issued
          at enrollment. We may revoke access if your DID, domain, or handle is lost, transferred, or disputed.
        </p>
      </LegalSection>

      <LegalSection marker="§3 · Acceptable use" title="What you may send">
        <p>
          Use of the relay is subject to reasonable acceptable use standards. Send only your own mail, to recipients who asked
          for it, and honor unsubscribe requests. Violating acceptable use can result in throttling, labeling, or suspension
          without notice.
        </p>
      </LegalSection>

      <LegalSection marker="§4 · Warranties" title="Service provided &ldquo;AS IS&rdquo;">
        <p>
          THE SERVICE IS PROVIDED <strong>AS IS</strong> AND <strong>AS AVAILABLE</strong>, WITHOUT WARRANTIES OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, OR UNINTERRUPTED OPERATION. We do not warrant that mail submitted through the relay will be
          accepted, delivered, or placed in any particular inbox folder.
        </p>
      </LegalSection>

      <LegalSection marker="§5 · Liability" title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, Atmosphere Mail LLC and its members, officers, and contributors WILL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE,
          BUSINESS, OR REPUTATION, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE
          POSSIBILITY OF SUCH DAMAGES. Our aggregate liability for any claim arising out of or relating to the service is
          limited to one hundred U.S. dollars ($100).
        </p>
      </LegalSection>

      <LegalSection marker="§6 · Termination" title="Ending the relationship">
        <p>
          You may stop using the relay at any time. If you can&apos;t reach the dashboard (lost handle, atproto identity
          rotated, locked out), email{" "}
          <a href="mailto:postmaster@atmos.email">postmaster@atmos.email</a> from a mailbox you can prove control of, or sign
          the request with your DID&apos;s signing key, and we&apos;ll process it within 14 days.
        </p>
        <p>
          We may suspend or terminate access for any reason, including acceptable use violations, legal requirements, or discontinuation
          of the service. Upon termination we will stop accepting mail from your DID; terminal message logs are retained under the
          retention schedule disclosed in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection marker="§7 · Changes" title="Updates to these terms">
        <p>
          We may update these terms as the service evolves. Notices we send you go to the contact email on file. Notices you send
          us go to <a href="mailto:postmaster@atmos.email">postmaster@atmos.email</a>. We will give at least 30 days&apos; notice by
          email before material changes to these terms take effect; non-material changes (typo fixes, clarifications that do not
          affect your rights or obligations) may take effect on publication. Continued use of the relay after the effective date
          of an update means you accept the revised terms.
        </p>
      </LegalSection>

      <LegalSection marker="§8 · Miscellaneous" title="Boilerplate">
        <p>
          <strong>Survival.</strong> Sections §4 (Warranties), §5 (Liability), §9 (Governing law), and any obligation that by its
          nature should survive (including suppression-list retention and DKIM-key revocation) will continue in effect after this
          agreement ends.
        </p>
        <p>
          <strong>Assignment.</strong> You may not assign these terms or transfer your account without our written consent. We may
          assign this agreement to a successor entity (for example, in connection with a merger, reorganization, or transfer to a
          cooperative vehicle that takes on operation of the relay) and will notify you by email at least 30 days before the
          effective date of the assignment.
        </p>
        <p>
          <strong>Severability.</strong> If any provision of these terms is held invalid or unenforceable, the remaining provisions
          stay in effect.
        </p>
        <p>
          <strong>No waiver.</strong> Our failure to enforce any provision is not a waiver of our right to enforce it later.
        </p>
        <p>
          <strong>Entire agreement.</strong> These terms and the <Link href="/privacy">Privacy Policy</Link> are the entire
          agreement between you and Atmosphere Mail LLC and supersede any earlier understanding about the relay.
        </p>
      </LegalSection>

      <LegalSection marker="§9 · Governing law" title="Jurisdiction">
        <p>
          These terms are governed by the laws of the State of Washington, United States, without regard to its conflicts of law
          rules. Any dispute that cannot be resolved by correspondence with{" "}
          <a href="mailto:postmaster@atmos.email">postmaster@atmos.email</a> will be heard in the state or federal courts sitting in
          King County, Washington.
        </p>
      </LegalSection>

      <LegalSection marker="§10 · Contact" title="Reach us">
        <p>
          Atmosphere Mail LLC, <a href="mailto:postmaster@atmos.email">postmaster@atmos.email</a>. For abuse reports use{" "}
          <a href="mailto:abuse@atmos.email">abuse@atmos.email</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

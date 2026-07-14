import Link from "next/link";

// Content sourced directly from Sprintora-Terms-of-Service-DRAFT.docx —
// not rewritten or embellished. Placeholders ([COMPANY LEGAL NAME],
// governing law, fee terms) are left visibly unresolved rather than
// guessed at; filling those in is a legal decision, not a copy-editing
// one. Contact email and "last updated" date are the only values filled
// in here, since both are already known, factual, and non-legal.
export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="container legal-container">
        <Link href="/" className="btn btn-secondary" style={{ marginBottom: 24 }}>
          &larr; Back to Sprintora
        </Link>
        <h1>Terms of Service</h1>
        <p className="legal-draft-notice">
          This is a preliminary Terms of Service, published for transparency during early
          access. It has not yet completed legal review, and sections marked with brackets
          are still pending finalization. A reviewed, finalized version will replace this
          once available.
        </p>
        <p className="legal-updated">Last updated: 2026-07-14</p>

        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of Sprintora
          (the &ldquo;Service&rdquo;), currently operated as an early-access beta by
          [COMPANY LEGAL NAME &mdash; entity not yet finalized as of this draft]. By creating
          an account or using the Service, you agree to these Terms on behalf of yourself
          and, if applicable, the organization you represent.
        </p>

        <h2>1. Beta / Early Access Status</h2>
        <p>
          The Service is provided in early access (&ldquo;beta&rdquo;). Features may change,
          break, or be removed without notice. The Service is provided without any uptime
          commitment or service-level agreement while in beta. You should not rely on the
          Service for data or workflows where loss or downtime would cause serious harm.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You must provide accurate information when creating an account and are responsible
          for maintaining the confidentiality of your login credentials. You are responsible
          for all activity that occurs under your account. Notify us immediately of any
          unauthorized use.
        </p>

        <h2>3. Acceptable Use</h2>
        <p>
          You agree not to: (a) use the Service for any unlawful purpose; (b) attempt to
          gain unauthorized access to other accounts, projects, or data; (c) upload
          malicious code; (d) reverse engineer or attempt to extract the source code of the
          Service, except as permitted by law; or (e) use the Service in a way that places
          excessive load on our infrastructure with intent to disrupt it.
        </p>

        <h2>4. Your Content</h2>
        <p>
          You retain ownership of the projects, tasks, and other content you or your team
          submit to the Service (&ldquo;Customer Content&rdquo;). You grant us a limited
          license to host, process, and display Customer Content solely to operate and
          improve the Service. We do not claim ownership of your Customer Content.
        </p>

        <h2>5. Team Members and Invitations</h2>
        <p>
          If you invite other individuals to a project, you represent that you have the
          authority to do so and that those individuals consent to their information (name,
          email) being visible to other members of that project.
        </p>

        <h2>6. Data Processing and Subprocessors</h2>
        <p>
          The Service is built on third-party infrastructure providers, currently including
          Google Firebase (authentication and database), Vercel (hosting), and Paystack
          (payment processing for paid plans). These providers may process Customer Content
          and account data as subprocessors on our behalf. See the Privacy Policy for
          details.
        </p>

        <h2>7. Fees</h2>
        <p>
          Paid plans (Starter, Team, and Business) are billed monthly through Paystack, as
          described on our pricing page. A 14-day free trial is available with no payment
          method required; you will only be charged if you add a payment method during or
          after the trial. [PLACEHOLDER &mdash; replace with finalized refund policy and any
          additional payment-processor terms once confirmed with counsel.]
        </p>

        <h2>8. Termination</h2>
        <p>
          You may stop using the Service and delete your account at any time. We may suspend
          or terminate access to the Service, with or without notice, for conduct that
          violates these Terms or for any reason during the beta period, including
          discontinuing the Service entirely.
        </p>

        <h2>9. Disclaimer of Warranties</h2>
        <p style={{ textTransform: "uppercase", fontSize: 13 }}>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
          warranties of any kind, whether express or implied, including warranties of
          merchantability, fitness for a particular purpose, or non-infringement, to the
          maximum extent permitted by law.
        </p>

        <h2>10. Limitation of Liability</h2>
        <p style={{ textTransform: "uppercase", fontSize: 13 }}>
          To the maximum extent permitted by law, [COMPANY LEGAL NAME] shall not be liable
          for any indirect, incidental, special, consequential, or punitive damages, or any
          loss of data, profits, or business, arising out of or related to your use of the
          service. [PLACEHOLDER &mdash; a lawyer should tailor this section, including any
          liability cap, to the applicable governing law.]
        </p>

        <h2>11. Governing Law</h2>
        <p>
          [PLACEHOLDER &mdash; specify governing state/country and jurisdiction for disputes
          once the operating entity and its location are finalized.]
        </p>

        <h2>12. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. We will make reasonable efforts to
          notify active users of material changes before they take effect.
        </p>

        <h2>13. Contact</h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:theasaphmedia@gmail.com">theasaphmedia@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}

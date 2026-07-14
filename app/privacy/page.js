import Link from "next/link";

// Content sourced directly from Sprintora-Privacy-Policy-DRAFT.docx —
// not rewritten or embellished. See app/terms/page.js for the same note
// on why placeholders are left visible rather than guessed at.
export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="container legal-container">
        <Link href="/" className="btn btn-secondary" style={{ marginBottom: 24 }}>
          &larr; Back to Sprintora
        </Link>
        <h1>Privacy Policy</h1>
        <p className="legal-draft-notice">
          This is a preliminary Privacy Policy, published for transparency during early
          access. It has not yet completed legal review, and sections marked with brackets
          are still pending finalization &mdash; particularly the sections on legal basis,
          data subject rights, and international transfers. A reviewed, finalized version
          will replace this once available.
        </p>
        <p className="legal-updated">Last updated: 2026-07-14</p>

        <p>
          This Privacy Policy describes how Sprintora (&ldquo;we&rdquo;, &ldquo;us&rdquo;),
          currently operated as an early-access beta by [COMPANY LEGAL NAME &mdash; entity
          not yet finalized as of this draft], collects, uses, and shares information in
          connection with the Sprintora application (the &ldquo;Service&rdquo;).
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          <strong>Account information:</strong> name and email address, collected when you
          sign up (directly, or via Google sign-in).
        </p>
        <p>
          <strong>Content you provide:</strong> project names, task titles, and related
          content you or your teammates create in the Service (&ldquo;Customer
          Content&rdquo;).
        </p>
        <p>
          <strong>Usage data:</strong> basic technical data such as login timestamps,
          generated automatically as part of operating the Service.
        </p>
        <p>
          <strong>Billing information:</strong> if you subscribe to a paid plan, payment
          details are collected and processed directly by Paystack, our payment processor
          &mdash; we do not receive or store your card details ourselves.
        </p>

        <h2>2. How We Use Information</h2>
        <p>
          We use collected information to: provide and operate the Service; authenticate
          accounts; enable collaboration features such as team invitations; process
          subscription payments; send account-related emails (assignment notifications,
          due-date reminders, and billing-related messages, some of which you can opt out
          of in Account settings); and communicate with you about the Service, including
          security or policy notices.
        </p>

        <h2>3. Third-Party Subprocessors</h2>
        <p>
          We rely on the following infrastructure providers to operate the Service, each of
          which may process personal data on our behalf:
        </p>
        <ul className="legal-list">
          <li>Google Firebase &mdash; authentication and database hosting.</li>
          <li>Vercel &mdash; application hosting.</li>
          <li>Paystack &mdash; payment processing for paid plans.</li>
          <li>Google (Gmail) &mdash; outbound transactional email delivery.</li>
        </ul>
        <p>
          [PLACEHOLDER &mdash; list any additional processors added later.]
        </p>

        <h2>4. Data Sharing Within a Project</h2>
        <p>
          When you are added to a project, your name and email address become visible to
          other members of that project, and to the project owner, so the team can
          collaborate.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          We retain account and Customer Content data for as long as your account is active.
          If you delete a project, its associated task data is deleted from the Service.
          [PLACEHOLDER &mdash; confirm actual backup/retention behavior in Firestore before
          finalizing, including how long deleted data may persist in backups.]
        </p>

        <h2>6. Your Rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct, export, or
          delete your personal data. [PLACEHOLDER &mdash; a lawyer should tailor this
          section to the specific rights that apply, e.g. Nigeria&apos;s Data Protection Act
          (NDPA), GDPR for EU users, or CCPA/CPRA for California residents, based on where
          your users are located.]
        </p>

        <h2>7. International Data Transfers</h2>
        <p>
          [PLACEHOLDER &mdash; describe where data is physically stored (Firestore region)
          and, since infrastructure providers are based outside Nigeria, the legal mechanism
          relied on for any cross-border transfer under the NDPA.]
        </p>

        <h2>8. Security</h2>
        <p>
          We use reasonable technical measures, including authentication and access-control
          rules, to protect Customer Content from unauthorized access. No method of storage
          or transmission is completely secure, and we cannot guarantee absolute security,
          particularly during the beta period.
        </p>

        <h2>9. Children&apos;s Privacy</h2>
        <p>
          The Service is not directed to individuals under 16, and we do not knowingly
          collect personal data from children.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will make reasonable
          efforts to notify active users of material changes before they take effect.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about this Privacy Policy, or requests regarding your personal data, can
          be sent to <a href="mailto:theasaphmedia@gmail.com">theasaphmedia@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <>
      <header>
        <nav className="nav">
          <div className="logo"><div className="logo-mark">S</div>Sprintora</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="nav-actions">
            <Link href="/login" className="btn btn-secondary">Log in</Link>
            <Link href="/signup" className="btn btn-primary">Sign up free</Link>
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="hero-badge"><span className="dot"></span> Early access &mdash; free during beta</div>
            <h1>Project management that doesn&apos;t <span>slow down</span> as your team grows</h1>
            <p className="lead">
              Most project tools get slower and harder to onboard onto as teams scale.
              Sprintora is built to stay fast at scale, get new teammates working in
              minutes, and keep notifications useful instead of overwhelming.
            </p>
            <div className="hero-ctas">
              <Link href="/signup" className="btn btn-primary btn-large">Create your free account</Link>
              <a href="#features" className="btn btn-secondary btn-large">See what&apos;s different</a>
            </div>
          </div>
          <div>
            <div style={{background:"var(--white)",border:"1px solid var(--slate-200)",borderRadius:16,boxShadow:"var(--shadow-lg)",overflow:"hidden"}}>
              <div style={{background:"var(--navy)",padding:"16px 20px",display:"flex",gap:8}}>
                <span style={{width:10,height:10,borderRadius:"50%",background:"rgba(255,255,255,0.25)"}}></span>
                <span style={{width:10,height:10,borderRadius:"50%",background:"rgba(255,255,255,0.25)"}}></span>
                <span style={{width:10,height:10,borderRadius:"50%",background:"rgba(255,255,255,0.25)"}}></span>
              </div>
              <div style={{padding:24}}>
                <div className="board" style={{gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:0}}>
                  <div className="board-col" style={{padding:10,minHeight:"auto"}}>
                    <h4>To Do</h4>
                    <div className="task-card">Draft onboarding flow</div>
                  </div>
                  <div className="board-col" style={{padding:10,minHeight:"auto"}}>
                    <h4>In Progress</h4>
                    <div className="task-card">Fix API rate limit</div>
                  </div>
                  <div className="board-col" style={{padding:10,minHeight:"auto"}}>
                    <h4>Done</h4>
                    <div className="task-card">Q3 roadmap</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Why Sprintora</div>
            <h2>Built around what actually frustrates teams today</h2>
            <p>Grounded in real, current user complaints about the big project management tools &mdash; not generic feature marketing.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">&#9889;</div>
              <h3>Stays fast at scale</h3>
              <p>A common complaint about feature-dense tools is lag once workspaces hit tens of thousands of items. Sprintora&apos;s data model is built to stay responsive as your task list grows.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#127919;</div>
              <h3>Onboard in minutes</h3>
              <p>Steep learning curves are the top reason teams abandon feature-heavy tools. Sprintora ships with one board, one flow, and nothing to configure before your team can start.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#128276;</div>
              <h3>Notifications that respect you</h3>
              <p>Notification overload is a recurring complaint on tools like Asana. Sprintora defaults to calm, relevant alerts instead of one email per keystroke.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#128274;</div>
              <h3>Secure sign-in</h3>
              <p>Email/password or one-click Google sign-in, so your team isn&apos;t stuck managing yet another password.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#128101;</div>
              <h3>Built for teams, not just individuals</h3>
              <p>Invite teammates into a project, assign work, and manage access with owner/member roles.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#127760;</div>
              <h3>Built for global teams</h3>
              <p>Available worldwide today. Localized language support is on the roadmap as we grow beyond English-first.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Pricing</div>
            <h2>Free during beta</h2>
            <p>Sprintora is in early access. Every account is free right now &mdash; paid plans will be introduced later, with plenty of notice.</p>
          </div>
          <div className="pricing-grid">
            <div className="price-card featured">
              <div className="price-badge">Available now</div>
              <h3>Early Access</h3>
              <p className="price-desc">Full product, free while we&apos;re in beta</p>
              <div className="price-amount"><span className="num">$0</span></div>
              <ul className="price-list">
                <li>Unlimited projects &amp; tasks</li>
                <li>Unlimited team members</li>
                <li>Email/password or Google sign-in</li>
                <li>Direct input into what we build next</li>
              </ul>
              <Link href="/signup" className="btn btn-primary btn-block">Create free account</Link>
            </div>
          </div>
          <p className="beta-note">No credit card required. We&apos;ll email everyone before any pricing changes take effect.</p>
        </div>
      </section>

      <section className="final-cta">
        <div className="container">
          <h2>Try Sprintora today</h2>
          <p>Set up your first project in under a minute.</p>
          <Link href="/signup" className="btn btn-primary btn-large">Get started free</Link>
        </div>
      </section>

      <footer>
        &copy; 2026 Sprintora &mdash; currently in early access. Built with Firebase &amp; Vercel.
      </footer>
    </>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="Stride home">
          <span className="wordmark-mark" aria-hidden="true">
            S
          </span>
          <span>stride</span>
        </Link>
        <span className="topbar-note">A more thoughtful way to train</span>
      </header>
      <section className="intro" aria-labelledby="intro-title">
        <p className="eyebrow">
          <span className="status-dot" /> Built for the long run
        </p>
        <h1 id="intro-title">
          Your running,
          <br />
          <span>with context.</span>
        </h1>
        <p className="intro-copy">
          Road miles, trail days, race goals, recovery. Stride is being built to
          bring the whole picture of your training together.
        </p>
        <div className="foundation-note">
          <span className="note-index">01</span>
          <p>
            Personal coaching starts with understanding the athlete behind every
            run.
          </p>
          <span className="note-arrow" aria-hidden="true">
            ↗
          </span>
        </div>
      </section>
      <footer className="footer">
        <span>Road and trail, in one stride.</span>
        <span className="footer-meta">
          Personal running coach · In foundation
        </span>
      </footer>
    </main>
  );
}

import Link from "next/link";

const Hero = () => {
  return (
    <section className="hero">
      <div>
        <p className="pill">Sustainable actions → tangible rewards</p>
        <h1>
          Keep the campus clean. <span className="highlight">Earn credits.</span>
        </h1>
        <p className="lead">
          Upload proof of responsible waste disposal, report found items, and redeem credits for
          events and perks. EcoSync connects environmental action and community honesty.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/uploads">
            Start uploading
          </Link>
          <Link className="btn ghost" href="/rewards">
            View rewards
          </Link>
        </div>
      </div>
      <div className="hero__card">
        <p className="hero__label">Live impact</p>
        <div className="hero__stats">
          <div>
            <p className="stat-number">+124</p>
            <p className="stat-label">Cleanups logged</p>
          </div>
          <div>
            <p className="stat-number">86</p>
            <p className="stat-label">Items returned</p>
          </div>
        </div>
        <p className="muted">
          Every verified upload grants credits you can redeem for college events today—and for
          shopping perks soon.
        </p>
      </div>
    </section>
  );
};

export default Hero;


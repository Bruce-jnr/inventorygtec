import { ArrowDown, FileCheck2, GraduationCap, LockKeyhole, UserRound } from 'lucide-react'

export default function PortalHero() {
  return (
    <section className="portal-hero" aria-labelledby="portal-title">
      <div className="hero-inner">
        <div className="page-heading">
          <span className="eyebrow">CANDIDATE PORTAL</span>
          <h1 id="portal-title">Your next chapter starts here.</h1>
          <p>Register your details and documents in one secure place. A simple start to what comes next.</p>
          <a className="primary-button hero-cta" href="#registration-form">Start registration <ArrowDown size={18} /></a>
        </div>
        <div className="hero-records" aria-hidden="true">
          <div className="hero-document document-back"><FileCheck2 size={24} /><span>Supporting documents</span><div className="document-line" /><div className="document-line short" /></div>
          <div className="hero-document document-front">
            <div className="document-top"><span className="document-brand"><GraduationCap size={22} /></span><span>CANDIDATE REGISTRY</span><LockKeyhole size={15} /></div>
            <div className="document-identity"><span className="document-avatar"><UserRound size={33} strokeWidth={1.3} /></span><div><strong>Your next chapter.</strong><small>One record. All your essentials.</small></div></div>
            <div className="document-detail"><span>Personal information</span><span className="document-check">01</span></div>
            <div className="document-detail"><span>Passport photograph</span><span className="document-check">02</span></div>
            <div className="document-detail"><span>Supporting certificate</span><span className="document-check">03</span></div>
            <div className="document-footer"><LockKeyhole size={13} />Private by design</div>
          </div>
          <div className="hero-document document-note"><span className="note-icon"><FileCheck2 size={21} /></span><div><strong>Everything in one place.</strong><small>Ready for your next step.</small></div></div>
        </div>
      </div>
    </section>
  )
}

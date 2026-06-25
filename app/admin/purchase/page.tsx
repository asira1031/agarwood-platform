"use client";

import Link from "next/link";

export default function AdminPurchasesPage() {
  return (
    <main className="page">
      <div className="forestGlow forestGlowOne" />
      <div className="forestGlow forestGlowTwo" />

      <section className="shell">
        <div className="hero">
          <div className="heroCopy">
            <Link href="/admin/dashboard" className="backLink">
              ← Back to Admin Dashboard
            </Link>

            <p className="eyebrow">Arganwood Admin</p>
            <h1>Purchase Debug Tools Hidden</h1>

            <p className="subtitle">
              This production-safe screen replaces the old raw purchase
              troubleshooter for buyer/client demo protection.
            </p>

            <div className="heroActions">
              <Link href="/admin/dashboard" className="primaryButton">
                Return to Dashboard
              </Link>
              <span className="secureBadge">Production Safe</span>
            </div>
          </div>

          <div className="statusCard glass">
            <div className="statusIcon">🛡️</div>
            <small>Admin Safety Mode</small>
            <strong>Protected</strong>
            <p>
              Raw database health checks, table inspectors, customer traces,
              wallet logs, trees, and inventory records are not exposed here.
            </p>
          </div>
        </div>

        <section className="grid">
          <article className="glass noticeCard">
            <div className="cardTop">
              <span className="miniIcon">🌿</span>
              <p className="eyebrow small">Safety Notice</p>
            </div>
            <h2>Normal admins should not access raw debug tools.</h2>
            <p>
              The previous purchase troubleshooter was useful for internal
              testing, but it exposed technical diagnostics that should not be
              visible during production demos or buyer reviews.
            </p>
          </article>

          <article className="glass noticeCard">
            <div className="cardTop">
              <span className="miniIcon">🔒</span>
              <p className="eyebrow small">Debug Tools Hidden</p>
            </div>
            <h2>No raw tables are displayed on this route.</h2>
            <p>
              Database health, table inspection, customer profile tracing,
              wallet transactions, recent trees, and inventory stock views have
              been intentionally removed from this normal admin page.
            </p>
          </article>

          <article className="glass noticeCard wide">
            <div className="cardTop">
              <span className="miniIcon">✨</span>
              <p className="eyebrow small">Internal Only</p>
            </div>
            <h2>Use a separate protected internal route for troubleshooting.</h2>
            <p>
              If the old debugger is still needed, keep it outside normal admin
              navigation, such as under an internal-only debug route protected
              by a super-admin check.
            </p>
          </article>
        </section>
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          padding: 32px;
          font-family: Arial, Helvetica, sans-serif;
          color: #fff8e7;
          background:
            radial-gradient(circle at 18% 12%, rgba(214, 178, 94, .18), transparent 26%),
            radial-gradient(circle at 86% 8%, rgba(255, 255, 255, .08), transparent 24%),
            linear-gradient(135deg, #06110d 0%, #10281f 46%, #244536 100%);
        }

        .page::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(rgba(6, 17, 13, .72), rgba(6, 17, 13, .82)),
            repeating-linear-gradient(
              90deg,
              rgba(255, 255, 255, .025) 0,
              rgba(255, 255, 255, .025) 1px,
              transparent 1px,
              transparent 80px
            );
          pointer-events: none;
        }

        .forestGlow {
          position: absolute;
          border-radius: 999px;
          filter: blur(10px);
          pointer-events: none;
        }

        .forestGlowOne {
          width: 320px;
          height: 320px;
          left: -90px;
          top: -80px;
          background: rgba(214, 178, 94, .18);
        }

        .forestGlowTwo {
          width: 420px;
          height: 420px;
          right: -150px;
          bottom: -130px;
          background: rgba(63, 121, 88, .24);
        }

        .shell {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 22px;
          align-items: stretch;
          margin-bottom: 22px;
        }

        .heroCopy {
          min-height: 420px;
          border-radius: 36px;
          padding: 34px;
          background:
            radial-gradient(circle at 12% 8%, rgba(214, 178, 94, .16), transparent 30%),
            linear-gradient(135deg, rgba(255, 255, 255, .11), rgba(255, 255, 255, .045));
          border: 1px solid rgba(214, 178, 94, .22);
          box-shadow: 0 28px 80px rgba(0, 0, 0, .32);
          backdrop-filter: blur(18px);
        }

        .backLink {
          display: inline-flex;
          margin-bottom: 34px;
          color: #d6b25e;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: #d6b25e;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .eyebrow.small {
          margin-bottom: 0;
          font-size: 11px;
        }

        h1 {
          max-width: 780px;
          margin: 0;
          color: #fff8e7;
          font-size: clamp(44px, 7vw, 82px);
          line-height: .92;
          letter-spacing: -3px;
        }

        h2 {
          margin: 12px 0 10px;
          color: #fff8e7;
          font-size: 24px;
          line-height: 1.15;
          letter-spacing: -.5px;
        }

        .subtitle {
          max-width: 720px;
          margin: 20px 0 0;
          color: rgba(255, 248, 231, .78);
          font-size: 18px;
          font-weight: 800;
          line-height: 1.65;
        }

        .heroActions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 30px;
        }

        .primaryButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 14px 20px;
          color: #10281f;
          background: linear-gradient(135deg, #f1d28a, #d6b25e);
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 16px 34px rgba(214, 178, 94, .2);
        }

        .secureBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 13px 18px;
          color: #fff8e7;
          background: rgba(255, 255, 255, .09);
          border: 1px solid rgba(255, 248, 231, .16);
          font-weight: 900;
        }

        .glass {
          background: linear-gradient(135deg, rgba(255, 255, 255, .13), rgba(255, 255, 255, .055));
          border: 1px solid rgba(214, 178, 94, .2);
          box-shadow: 0 24px 70px rgba(0, 0, 0, .28);
          backdrop-filter: blur(18px);
        }

        .statusCard {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 420px;
          border-radius: 36px;
          padding: 28px;
        }

        .statusIcon {
          width: 74px;
          height: 74px;
          display: grid;
          place-items: center;
          margin-bottom: auto;
          border-radius: 24px;
          background: rgba(214, 178, 94, .16);
          border: 1px solid rgba(214, 178, 94, .28);
          font-size: 34px;
        }

        .statusCard small {
          color: #d6b25e;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .statusCard strong {
          display: block;
          margin-top: 8px;
          color: #fff8e7;
          font-size: 44px;
          letter-spacing: -1.4px;
        }

        .statusCard p,
        .noticeCard p {
          margin: 0;
          color: rgba(255, 248, 231, .72);
          font-size: 15px;
          font-weight: 800;
          line-height: 1.65;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .noticeCard {
          min-height: 230px;
          border-radius: 30px;
          padding: 24px;
        }

        .noticeCard.wide {
          grid-column: 1 / -1;
          min-height: 190px;
          background:
            radial-gradient(circle at 88% 12%, rgba(214, 178, 94, .16), transparent 28%),
            linear-gradient(135deg, rgba(255, 255, 255, .13), rgba(255, 255, 255, .055));
        }

        .cardTop {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .miniIcon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: rgba(214, 178, 94, .14);
          border: 1px solid rgba(214, 178, 94, .22);
        }

        @media (max-width: 980px) {
          .hero,
          .grid {
            grid-template-columns: 1fr;
          }

          .heroCopy,
          .statusCard {
            min-height: auto;
          }

          .statusIcon {
            margin-bottom: 40px;
          }
        }

        @media (max-width: 640px) {
          .page {
            padding: 18px;
          }

          .heroCopy,
          .statusCard,
          .noticeCard {
            border-radius: 26px;
            padding: 22px;
          }

          .backLink {
            margin-bottom: 28px;
          }

          h1 {
            font-size: 42px;
            letter-spacing: -1.8px;
          }

          .subtitle {
            font-size: 16px;
          }

          .primaryButton,
          .secureBadge {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
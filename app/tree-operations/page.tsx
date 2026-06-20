"use client";

export default function TreeOperationsPage() {
  return (
    <main className="page">
      <div className="container">
        <div className="pageHeader">
          <div>
            <h1>🌳 Tree Operations</h1>
            <p>
              Monitor care tasks, subscriptions, caretaker reports, and tree
              operations.
            </p>
          </div>
        </div>

        {/* CARD 1 */}
        <section className="overviewCard">
          <div className="cardHeader">
            <h2>Operations Overview</h2>
            <span>Today</span>
          </div>

          <div className="statsGrid">
            <div className="statBox">
              <div className="icon">🌳</div>
              <h3>128</h3>
              <p>Total Trees</p>
            </div>

            <div className="statBox">
              <div className="icon">📋</div>
              <h3>12</h3>
              <p>Active Tasks</p>
            </div>

            <div className="statBox">
              <div className="icon">🛡️</div>
              <h3>96</h3>
              <p>Covered By Care Plan</p>
            </div>

            <div className="statBox warning">
              <div className="icon">⚠️</div>
              <h3>5</h3>
              <p>Needs Attention</p>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f8f2e6;
          padding: 30px;
        }

        .container {
          max-width: 1400px;
          margin: auto;
        }

        .pageHeader h1 {
          margin: 0;
          font-size: 36px;
          color: #07351f;
        }

        .pageHeader p {
          margin-top: 8px;
          color: #6b6b62;
        }

        .overviewCard {
          margin-top: 25px;
          background: white;
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.08);
        }

        .cardHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .cardHeader h2 {
          margin: 0;
          color: #07351f;
        }

        .cardHeader span {
          background: #e7f5de;
          color: #0a7c2e;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .statBox {
          background: #fafaf7;
          border-radius: 18px;
          padding: 20px;
          text-align: center;
          border: 1px solid rgba(0,0,0,.06);
        }

        .statBox .icon {
          font-size: 34px;
          margin-bottom: 10px;
        }

        .statBox h3 {
          margin: 0;
          font-size: 34px;
          color: #07351f;
        }

        .statBox p {
          margin-top: 8px;
          color: #666;
          font-size: 14px;
        }

        .warning {
          background: #fff7e6;
        }

        @media (max-width: 900px) {
          .statsGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </main>
  );
}
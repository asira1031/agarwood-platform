import Link from "next/link";

export default function GardenerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5efe1", color: "#10281f" }}>
      <aside style={{ width: 260, padding: 24, background: "#10281f", color: "white" }}>
        <h2 style={{ margin: "0 0 6px" }}>Arganwood</h2>
        <p style={{ margin: "0 0 24px", opacity: .7 }}>Gardener Portal</p>

        <nav style={{ display: "grid", gap: 12 }}>
          <Link style={linkStyle} href="/gardener/dashboard">Dashboard</Link>
          <Link style={linkStyle} href="/gardener/assigned-trees">Assigned Trees</Link>
          <Link style={linkStyle} href="/gardener/tasks">Tasks</Link>
          <Link style={linkStyle} href="/gardener/photo-updates">Photo Updates</Link>
          <Link style={linkStyle} href="/gardener/gps-updates">GPS Updates</Link>
          <Link style={linkStyle} href="/gardener/health-reports">Health Reports</Link>
          <Link style={linkStyle} href="/gardener/concerns">Concerns</Link>
          <Link style={linkStyle} href="/login">Logout</Link>
        </nav>
      </aside>

      <section style={{ flex: 1 }}>
        {children}
      </section>
    </div>
  );
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,.08)",
  fontWeight: 800,
};

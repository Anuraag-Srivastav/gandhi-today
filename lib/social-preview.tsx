/** Shared, code-rendered social card. It intentionally excludes archival imagery. */
export function SocialPreview() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f3ead8",
        color: "#2a2418",
        padding: "64px 76px",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: "0 66.66% auto 0", height: 12, background: "#c45c26" }} />
      <div style={{ position: "absolute", inset: "0 33.33% auto 33.33%", height: 12, background: "#fbf6ea" }} />
      <div style={{ position: "absolute", inset: "0 0 auto 66.66%", height: 12, background: "#3f5c48" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ width: 92, height: 92, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #d9ba7a", borderRadius: 46, background: "#fbf6ea" }}>
          <svg width="62" height="62" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="22" fill="none" stroke="#c45c26" strokeWidth="2" />
            <circle cx="32" cy="32" r="3.2" fill="#2a2418" />
            <path d="M32 10v44M10 32h44M16.4 16.4l31.2 31.2M47.6 16.4 16.4 47.6" stroke="#3f5c48" strokeWidth="1.5" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 7, textTransform: "uppercase", color: "#6b5e4a" }}>Gandhi Says</div>
          <div style={{ fontSize: 66, lineHeight: 1.05, marginTop: 12, fontFamily: "Georgia, serif" }}>What would Gandhi say today?</div>
        </div>
      </div>

      <div style={{ marginTop: 58, width: 940, fontSize: 35, lineHeight: 1.35, color: "#6b5e4a", fontFamily: "Georgia, serif" }}>
        Historical sources. Careful interpretation for present-day questions.
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "#8c6e4a" }}>
        <span>gandhisays.com</span>
        <span>His record, and what it might mean now</span>
      </div>
    </div>
  );
}

/** Compact Open Graph mark for apps that render link previews as square thumbnails. */
export function SocialIconPreview() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3ead8", position: "relative" }}>
      <div style={{ position: "absolute", inset: "0 66.66% auto 0", height: 10, background: "#c45c26" }} />
      <div style={{ position: "absolute", inset: "0 33.33% auto 33.33%", height: 10, background: "#fbf6ea" }} />
      <div style={{ position: "absolute", inset: "0 0 auto 66.66%", height: 10, background: "#3f5c48" }} />
      <div style={{ width: 360, height: 360, display: "flex", alignItems: "center", justifyContent: "center", border: "5px solid #d9ba7a", borderRadius: 180, background: "#fbf6ea" }}>
        <svg width="260" height="260" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="22" fill="none" stroke="#c45c26" strokeWidth="2" />
          <circle cx="32" cy="32" r="3.2" fill="#2a2418" />
          <path d="M32 10v44M10 32h44M16.4 16.4l31.2 31.2M47.6 16.4 16.4 47.6" stroke="#3f5c48" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

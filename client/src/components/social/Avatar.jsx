export default function Avatar({ photoUrl, displayName, size = 44 }) {
  const initial = String(displayName || "?").trim().charAt(0).toUpperCase();
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName || ""}
        referrerPolicy="no-referrer"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{ width: size, height: size, objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        color: "var(--color-text)",
        background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.28), rgba(0,0,0,0.12))"
      }}
    >
      {initial}
    </div>
  );
}

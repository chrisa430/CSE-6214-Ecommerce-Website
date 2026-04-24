interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, totalItems, pageSize, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // Build page number list with ellipsis
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btnBase: React.CSSProperties = {
    padding: "6px 11px",
    fontSize: 13,
    minWidth: 36,
    borderRadius: 8,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 18 }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        Showing {start}–{end} of {totalItems}
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          className="btn"
          style={btnBase}
          disabled={page === 1}
          onClick={() => onChange(1)}
          title="First page"
        >
          «
        </button>
        <button
          className="btn"
          style={btnBase}
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          ‹ Prev
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`el-${i}`} style={{ color: "var(--muted)", padding: "0 4px", fontSize: 14 }}>…</span>
          ) : (
            <button
              key={p}
              className="btn"
              style={{
                ...btnBase,
                background: p === page ? "linear-gradient(135deg, rgba(124,92,255,0.45), rgba(124,92,255,0.28))" : undefined,
                borderColor: p === page ? "rgba(124,92,255,0.60)" : undefined,
                color: p === page ? "#fff" : undefined,
                fontWeight: p === page ? 700 : 600,
              }}
              onClick={() => onChange(p as number)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="btn"
          style={btnBase}
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next ›
        </button>
        <button
          className="btn"
          style={btnBase}
          disabled={page === totalPages}
          onClick={() => onChange(totalPages)}
          title="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}

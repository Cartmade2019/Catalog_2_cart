import { useState } from "react";

const DeleteModal = ({ active, onClose, onDelete, count = 1 }: any) => {
  const [loading, setLoading] = useState(false);
  const [closeHover, setCloseHover] = useState(false);
  const [cancelHover, setCancelHover] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);

  const handleDelete = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onDelete();
      onClose();
    }, 2000);
  };

  const handleBackDropClick = () => {
    onClose();
  };

  if (!active) return null;

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div
        onClick={handleBackDropClick}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.5)",
          backdropFilter: "blur(6px)",
          zIndex: 1000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff",
            borderRadius: 16,
            maxWidth: 400,
            width: "100%",
            boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#0F172A",
              }}
            >
              Delete
            </span>
            <button
              onClick={onClose}
              onMouseEnter={() => setCloseHover(true)}
              onMouseLeave={() => setCloseHover(false)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: closeHover ? "#E2E8F0" : "#F1F5F9",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94A3B8",
                transition: "background 0.15s",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="1" y1="1" x2="13" y2="13" />
                <line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
          </div>

          {/* Warning icon */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingBottom: 14,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#FEF2F2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
          </div>

          {/* Body text */}
          <div
            style={{
              fontSize: 13,
              color: "#64748B",
              textAlign: "center",
              lineHeight: 1.6,
              padding: "0 22px",
            }}
          >
        {count > 1
              ? `${count} catalogs and all their hotspots will be permanently deleted. This action cannot be undone.`
              : "This catalog and all its hotspots will be permanently deleted. This action cannot be undone."}
          </div>

          {/* Button row */}
          <div
            style={{
              padding: "16px 22px 22px",
              display: "flex",
              gap: 10,
            }}
          >
            <button
              onClick={onClose}
              onMouseEnter={() => setCancelHover(true)}
              onMouseLeave={() => setCancelHover(false)}
              style={{
                flex: 1,
                background: cancelHover ? "#E2E8F0" : "#F1F5F9",
                color: "#374151",
                border: "none",
                borderRadius: 9,
                padding: 11,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              onMouseEnter={() => setDeleteHover(true)}
              onMouseLeave={() => setDeleteHover(false)}
              style={{
                flex: 1,
                background: loading
                  ? "#EF4444"
                  : deleteHover
                    ? "#B91C1C"
                    : "#DC2626",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: 11,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {loading && (
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                    flexShrink: 0,
                  }}
                />
              )}
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DeleteModal;
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Junior Imports - inicio">
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 10h17v25c0 8-5 13-13 13h-4V35h3c2 0 3-1 3-3V10Z" fill="currentColor" />
        <path d="M31 10h11v13h12L38 39 22 23h9V10Z" fill="#1677ff" />
      </svg>
      {!compact && (
        <span className="brand-text">
          <strong>JUNIOR</strong>
          <small>IMPORTS</small>
        </span>
      )}
    </Link>
  );
}

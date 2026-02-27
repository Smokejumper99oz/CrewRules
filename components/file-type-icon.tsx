"use client";

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        fill="#E74C3C"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8.5 13H7v4h1.5v-1.5h.5c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1zm3.5 1.5c0 .83-.67 1.5-1.5 1.5H10v-4h1c.83 0 1.5.67 1.5 1.5v1zm2 1.5h1v-1.5h.5v-1h-.5V14h-1v1zm1.5-1.5c0 .55-.45 1-1 1h-1v-1h1c.55 0 1 .45 1 1z"
      />
    </svg>
  );
}

function WordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        fill="#2B579A"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zm-1.5 12H10l-1.5-6h1.5l.9 4 .9-4H14l-1.5 6zm3.5 0h-1.5v-6H16v6z"
      />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        fill="#94a3b8"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zm-2 12H8v-2h3v2zm0-4H8v-2h3v2zm4 4h-3v-2h3v2zm0-4h-3v-2h3v2z"
      />
    </svg>
  );
}

export function FileTypeIcon({ fileName, className = "h-5 w-5 shrink-0" }: { fileName: string; className?: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const icon =
    ext === "pdf" ? (
      <PdfIcon className={className} />
    ) : ext === "doc" || ext === "docx" ? (
      <WordIcon className={className} />
    ) : (
      <DocIcon className={className} />
    );
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 shadow-[0_0_25px_rgba(117,192,67,0.15)]">
      {icon}
    </span>
  );
}

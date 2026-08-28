"use client";

import { useEffect, useState } from "react";
import { apiUrl, type VerificationDocument } from "@/lib/api";

export function VerificationDocumentPreview({
  endpoint,
  document,
  context = "Verification evidence",
}: {
  endpoint: string;
  document: VerificationDocument;
  context?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const protectedUrl = `${apiUrl}${endpoint}`;
  const filename = document.originalName || "Verification document";
  const mimeType = document.mimeType || "application/octet-stream";
  const image = mimeType.startsWith("image/");
  const pdf = mimeType === "application/pdf";

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    fetch(protectedUrl, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError("Document preview could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [protectedUrl]);

  return (
    <article className="verification-document-preview">
      <header>
        <div><strong>{filename}</strong><span>{mimeType}{document.sizeBytes !== null ? ` · ${formatBytes(document.sizeBytes)}` : ""}</span></div>
        {previewUrl && <a className="button button-outline button-small" href={previewUrl} target="_blank" rel="noopener noreferrer">Open document</a>}
      </header>
      {loading && <p className="verification-document-state" role="status">Loading secure preview…</p>}
      {error && <div className="verification-document-state form-error" role="alert"><span>{error}</span><a href={protectedUrl} target="_blank" rel="noopener noreferrer">Open securely instead</a></div>}
      {previewUrl && image && <a className="verification-document-image" href={previewUrl} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={previewUrl} alt={`${context}: ${filename}`} /></a>}
      {previewUrl && pdf && <div className="verification-document-pdf"><object data={previewUrl} type="application/pdf" aria-label={`Preview of ${filename}`}><p>PDF preview is unavailable. <a href={previewUrl} target="_blank" rel="noopener noreferrer">Open the document</a>.</p></object><p>Open the document for a more useful view on this screen.</p></div>}
      {previewUrl && !image && !pdf && <p className="verification-document-state">Inline preview is unavailable for this file type. Use “Open document” to inspect it.</p>}
    </article>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

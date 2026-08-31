"use client";

/** Portrait: shows the current image (or an upload affordance) and swaps it for
 *  a downscaled data URL when the user picks a file. FEATURE_PLAN §M5. */

import { useRef, useState } from "react";
import { resizeImageToDataUrl } from "@/lib/util/image";

export function PortraitUpload({
  current,
  onChange,
  size = 56,
  label = "portrait",
}: {
  current: string | undefined;
  onChange: (dataUrl: string | undefined) => void;
  size?: number;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await resizeImageToDataUrl(file));
    } catch {
      /* ignore bad files */
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <button
        onClick={() => inputRef.current?.click()}
        title={current ? "Replace portrait" : `Upload ${label}`}
        style={{
          width: size,
          height: size,
          padding: 0,
          borderColor: "var(--border2)",
          background: current ? `center/cover no-repeat url(${current})` : "var(--surface3)",
          color: "var(--text3)",
          fontSize: 9,
        }}
      >
        {busy ? "…" : current ? "" : "＋"}
      </button>
      {current && (
        <button onClick={() => onChange(undefined)} style={{ padding: "0 5px", fontSize: 8 }}>
          remove
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </span>
  );
}

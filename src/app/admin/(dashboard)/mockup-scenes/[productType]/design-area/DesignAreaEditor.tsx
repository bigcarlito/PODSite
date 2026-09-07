"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { setDesignAreaAction, uploadDesignImage, type DesignAreaState } from "../../../actions";
import type { DesignArea } from "@/lib/design/design-area";

const initialState: DesignAreaState = {};

const MIN_FRACTION = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function DesignAreaEditor({
  productType,
  sceneImageUrl,
  initialArea,
}: {
  productType: string;
  sceneImageUrl: string;
  initialArea: DesignArea;
}) {
  const [state, formAction, pending] = useActionState(setDesignAreaAction, initialState);

  const [rect, setRect] = useState<DesignArea>(initialArea);
  const [sceneAspectRatio, setSceneAspectRatio] = useState<number | null>(null);
  const [designAspectRatio, setDesignAspectRatio] = useState<number | null>(null);

  const [designUrl, setDesignUrl] = useState("");
  const [uploadError, setUploadError] = useState<string>();
  const [uploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    startClientX: number;
    startClientY: number;
    startRect: DesignArea;
  } | null>(null);

  // Locked aspect ratio (width/height, in *visual* terms) for the
  // rectangle — the design's own shape if we know it, otherwise whatever
  // shape the rectangle already has, so a plain drag/scale never distorts
  // it even before a reference design is loaded.
  function lockedRatio(): number {
    if (designAspectRatio && sceneAspectRatio) return designAspectRatio / sceneAspectRatio;
    return rect.width / rect.height;
  }

  // Snaps the rectangle to a newly-known aspect ratio (keeping its center
  // fixed) — called directly from the image onLoad handlers below, once
  // both the scene's and the reference design's natural dimensions are in.
  function snapToRatio(ratio: number) {
    setRect((prev) => {
      const cx = prev.x + prev.width / 2;
      const cy = prev.y + prev.height / 2;
      const width = prev.width;
      const height = width / ratio;
      const x = clamp(cx - width / 2, 0, 1 - width);
      const y = clamp(cy - height / 2, 0, 1 - height);
      return { x, y, width, height };
    });
  }

  function handleDesignFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(undefined);
    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadDesignImage(formData);
      if (result.error) {
        setUploadError(result.error);
      } else if (result.url) {
        setDesignUrl(result.url);
      }
    });
  }

  function onPointerDownMove(e: React.PointerEvent) {
    e.preventDefault();
    dragRef.current = { mode: "move", startClientX: e.clientX, startClientY: e.clientY, startRect: rect };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerDownResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode: "resize", startClientX: e.clientX, startClientY: e.clientY, startRect: rect };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;

    const box = container.getBoundingClientRect();
    const dxFrac = (e.clientX - drag.startClientX) / box.width;
    const dyFrac = (e.clientY - drag.startClientY) / box.height;

    if (drag.mode === "move") {
      const x = clamp(drag.startRect.x + dxFrac, 0, 1 - drag.startRect.width);
      const y = clamp(drag.startRect.y + dyFrac, 0, 1 - drag.startRect.height);
      setRect({ ...drag.startRect, x, y });
    } else {
      const ratio = lockedRatio();
      let width = clamp(drag.startRect.width + dxFrac, MIN_FRACTION, 1 - drag.startRect.x);
      let height = width / ratio;
      const maxHeight = 1 - drag.startRect.y;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }
      setRect({ ...drag.startRect, width, height });
    }
  }

  function onPointerUp() {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  return (
    <div className="mt-6 max-w-2xl">
      <div
        ref={containerRef}
        className="relative inline-block select-none"
        style={{ touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- needs plain onLoad for natural dimensions */}
        <img
          src={sceneImageUrl}
          alt={productType}
          className="block max-w-full rounded-lg border border-border"
          style={{ width: 480 }}
          draggable={false}
          onLoad={(e) => {
            const sar = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
            setSceneAspectRatio(sar);
            if (designAspectRatio != null) snapToRatio(designAspectRatio / sar);
          }}
        />
        <div
          onPointerDown={onPointerDownMove}
          className="absolute cursor-move border-2 border-accent bg-accent/20"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.width * 100}%`,
            height: `${rect.height * 100}%`,
          }}
        >
          <div
            onPointerDown={onPointerDownResize}
            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-accent"
          />
        </div>
      </div>

      <div className="mt-4 max-w-sm space-y-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Reference design</span>
          <span className="mb-1 block text-xs text-muted">
            Loaded only to lock the rectangle&apos;s proportions — not saved.
          </span>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={designUrl}
              onChange={(e) => setDesignUrl(e.target.value)}
              placeholder="https://.../design.png"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {uploading ? "…" : "+"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleDesignFileChange}
              className="hidden"
            />
          </div>
          {uploadError && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {uploadError}
            </p>
          )}
        </label>
        {designUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- needs plain onLoad for natural dimensions
          <img
            src={designUrl}
            alt=""
            className="hidden"
            onLoad={(e) => {
              const dar = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
              setDesignAspectRatio(dar);
              if (sceneAspectRatio != null) snapToRatio(dar / sceneAspectRatio);
            }}
          />
        )}
      </div>

      <form action={formAction} className="mt-4">
        <input type="hidden" name="productType" value={productType} />
        <input type="hidden" name="x" value={rect.x} />
        <input type="hidden" name="y" value={rect.y} />
        <input type="hidden" name="width" value={rect.width} />
        <input type="hidden" name="height" value={rect.height} />

        {state.error && (
          <p className="mb-2 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="mb-2 text-sm text-green-700" role="status">
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save design area"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { coverCrop, panCrop, zoomCrop, type PhotoCrop } from "@/lib/photo-crop";

type Point = { x: number; y: number };
type Gesture = { crop: PhotoCrop; zoom: number; dist: number; x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centerOf(crop: PhotoCrop): Point {
  return { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
}

/**
 * Shows the photo inside the same portrait frame as the vote card.
 * One finger drags. Two fingers pinch. A scroll wheel or the zoom buttons zoom.
 */
export function PhotoCropper({
  src,
  onCrop,
  onError,
  interactive = true,
  compact = false,
}: {
  src: string;
  onCrop: (crop: PhotoCrop) => void;
  onError?: () => void;
  interactive?: boolean;
  compact?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<PhotoCrop | null>(null);
  const cropRef = useRef<PhotoCrop | null>(null);
  const onCropRef = useRef(onCrop);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const gridTimer = useRef<number | null>(null);
  const [crop, setCrop] = useState<PhotoCrop | null>(null);
  const [cover, setCover] = useState<PhotoCrop | null>(null);
  const [grid, setGrid] = useState(false);
  const [settling, setSettling] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  onCropRef.current = onCrop;

  useEffect(() => {
    return () => {
      if (gridTimer.current) window.clearTimeout(gridTimer.current);
    };
  }, []);

  function revealGrid(ms?: number) {
    if (gridTimer.current) window.clearTimeout(gridTimer.current);
    gridTimer.current = null;
    setGrid(true);
    if (ms) {
      gridTimer.current = window.setTimeout(() => {
        setGrid(false);
        setSettling(false);
      }, ms);
    }
  }

  function hideGrid() {
    if (gridTimer.current) window.clearTimeout(gridTimer.current);
    gridTimer.current = null;
    setGrid(false);
    setSettling(false);
  }

  function publish(next: PhotoCrop) {
    cropRef.current = next;
    setCrop(next);
    onCropRef.current(next);
  }

  function frameSize(): { width: number; height: number } {
    const rect = frameRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 1, height: rect?.height ?? 1 };
  }

  function applyGesture(pinch: number, dx: number, dy: number) {
    const start = gesture.current;
    const cover = coverRef.current;
    if (!start || !cover) return;
    const frame = frameSize();
    const moved = panCrop(start.crop, dx, dy, frame.width, frame.height);
    const center = centerOf(moved);
    const nextZoom = Math.min(4, Math.max(1, start.zoom * pinch));
    publish(zoomCrop(cover, nextZoom, center.x, center.y));
  }

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !interactive) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const cover = coverRef.current;
      const current = cropRef.current;
      if (!cover || !current) return;
      const center = centerOf(current);
      const zoomNow = cover.width / current.width;
      const nextZoom = zoomNow * (event.deltaY < 0 ? 1.08 : 1 / 1.08);
      publish(zoomCrop(cover, nextZoom, center.x, center.y));
      revealGrid(500);
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [interactive]);

  function rememberGesture() {
    const cropNow = cropRef.current;
    const cover = coverRef.current;
    const points = [...pointers.current.values()];
    if (!cropNow || !cover || points.length === 0) {
      gesture.current = null;
      return;
    }
    const zoomNow = cover.width / cropNow.width;
    if (points.length >= 2) {
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      gesture.current = { crop: cropNow, zoom: zoomNow, dist: distance(points[0], points[1]), x: mid.x, y: mid.y };
      return;
    }
    gesture.current = { crop: cropNow, zoom: zoomNow, dist: 0, x: points[0].x, y: points[0].y };
  }

  function zoomBy(factor: number) {
    const base = coverRef.current;
    const current = cropRef.current;
    if (!base || !current) return;
    const center = centerOf(current);
    const zoomNow = base.width / current.width;
    publish(zoomCrop(base, zoomNow * factor, center.x, center.y));
    revealGrid(700);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The frame still follows the finger while it stays on the photo.
    }
    hideGrid();
    setGrabbing(true);
    revealGrid();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rememberGesture();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const start = gesture.current;
    if (points.length >= 2 && start.dist > 0) {
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      applyGesture(distance(points[0], points[1]) / start.dist, mid.x - start.x, mid.y - start.y);
      return;
    }
    applyGesture(1, points[0].x - start.x, points[0].y - start.y);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    rememberGesture();
    if (pointers.current.size === 0) {
      setGrabbing(false);
      revealGrid(280);
    }
  }

  const shown = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const zoom = cover && crop ? cover.width / crop.width : 1;

  return (
    <div className={`mx-auto w-full ${compact ? "max-w-[8.5rem]" : ""}`}>
      <div
        ref={frameRef}
        role={interactive ? "application" : undefined}
        aria-label={interactive ? "Crop photo" : undefined}
        className={`relative aspect-[3/4] w-full overflow-hidden rounded-[1.35rem] bg-[#e7e4de] select-none ${interactive ? `touch-none ${grabbing ? "cursor-grabbing" : "cursor-grab"}` : "pointer-events-none"}`}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerUp={interactive ? onPointerEnd : undefined}
        onPointerCancel={interactive ? onPointerEnd : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const next = coverCrop(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
            coverRef.current = next;
            setCover(next);
            publish(next);
            if (!interactive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            setSettling(true);
            revealGrid(1300);
          }}
          onError={onError}
          className={`pointer-events-none absolute max-w-none origin-center select-none ${settling ? "crop-settle" : ""}`}
          style={{
            width: `${100 / shown.width}%`,
            height: `${100 / shown.height}%`,
            left: `${(-shown.x / shown.width) * 100}%`,
            top: `${(-shown.y / shown.height) * 100}%`,
          }}
        />
        {interactive ? (
          <>
            <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${grid ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
              <span className="absolute inset-y-0 left-1/3 w-px bg-white/75" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-white/75" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-white/75" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-white/75" />
            </div>
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <span className="absolute top-2.5 left-2.5 h-5 w-5 border-t-[2.5px] border-l-[2.5px] border-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.55)]" />
              <span className="absolute top-2.5 right-2.5 h-5 w-5 border-t-[2.5px] border-r-[2.5px] border-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.55)]" />
              <span className="absolute bottom-2.5 left-2.5 h-5 w-5 border-b-[2.5px] border-l-[2.5px] border-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.55)]" />
              <span className="absolute right-2.5 bottom-2.5 h-5 w-5 border-r-[2.5px] border-b-[2.5px] border-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.55)]" />
            </div>
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2" onPointerDown={(event) => event.stopPropagation()}>
              <button
                type="button"
                aria-label="Zoom out"
                disabled={zoom <= 1.02}
                onClick={() => zoomBy(1 / 1.25)}
                className="flex h-9 w-9 items-center justify-center text-xl leading-none font-semibold shadow-[0_4px_14px_rgb(0_0_0/0.28)] disabled:opacity-40"
                style={{ backgroundColor: "#f6f1e8", color: "#274b3a", borderRadius: "999px" }}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={!cover || zoom >= 3.95}
                onClick={() => zoomBy(1.25)}
                className="flex h-9 w-9 items-center justify-center text-xl leading-none font-semibold shadow-[0_4px_14px_rgb(0_0_0/0.28)] disabled:opacity-40"
                style={{ backgroundColor: "#f6f1e8", color: "#274b3a", borderRadius: "999px" }}
              >
                +
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

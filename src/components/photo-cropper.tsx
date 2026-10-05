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
 * One finger drags. Two fingers pinch. A scroll wheel zooms on desktop.
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
  const [crop, setCrop] = useState<PhotoCrop | null>(null);
  onCropRef.current = onCrop;

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

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The frame still follows the finger while it stays on the photo.
    }
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
  }

  const shown = crop ?? { x: 0, y: 0, width: 1, height: 1 };

  return (
    <div className={`mx-auto grid w-full gap-2 ${compact ? "max-w-[8.5rem]" : "max-w-[18rem]"}`}>
      <div
        ref={frameRef}
        className={`relative aspect-[3/4] w-full overflow-hidden rounded-[1.35rem] bg-[#e7e4de] select-none ${interactive ? "touch-none" : "pointer-events-none"}`}
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
            const cover = coverCrop(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
            coverRef.current = cover;
            publish(cover, 1);
          }}
          onError={onError}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            width: `${100 / shown.width}%`,
            height: `${100 / shown.height}%`,
            left: `${(-shown.x / shown.width) * 100}%`,
            top: `${(-shown.y / shown.height) * 100}%`,
          }}
        />
      </div>
      {interactive ? <p className="text-center text-xs text-[#274b3a]/60">Drag to move. Pinch or scroll to zoom.</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ApiRequestError, requestJson } from "@/lib/client-api";
import { PHOTO_MAX_BYTES, normalizePhotoType } from "@/lib/photo-validation";

function discardUpload(id: string) {
  void fetch(`/api/photos/upload/${id}/discard`, {
    method: "POST",
    keepalive: true,
    headers: { accept: "application/json" },
  }).catch(() => {
    // The form is already gone. A later open starts a new photo.
  });
}

/**
 * Starts the storage upload and resize as soon as a photo is chosen.
 * The contest entry is created later, on submit.
 */
export function useEarlyPhotoUpload(active: boolean) {
  const generation = useRef(0);
  const uploadIdRef = useRef<string | null>(null);
  const pipelineRef = useRef<Promise<string | null> | null>(null);
  const readyRef = useRef(false);
  const keptRef = useRef(false);
  const failureRef = useRef<ApiRequestError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function invalidate() {
    if (keptRef.current) return;
    generation.current += 1;
    readyRef.current = false;
    const id = uploadIdRef.current;
    uploadIdRef.current = null;
    pipelineRef.current = null;
    setUploading(false);
    if (id) discardUpload(id);
  }

  function keep() {
    keptRef.current = true;
  }

  function start(file: File) {
    const gen = ++generation.current;
    readyRef.current = false;
    failureRef.current = null;
    setPhotoError(null);
    const previous = uploadIdRef.current;
    uploadIdRef.current = null;
    if (previous) discardUpload(previous);

    const task = (async (): Promise<string | null> => {
      setUploading(true);
      try {
        const contentType = normalizePhotoType(file.type, file.name);
        if (!contentType || file.size > PHOTO_MAX_BYTES || file.size < 1) return null;
        const presign = await requestJson<{ uploadId: string; uploadUrl: string; contentType: string }>(
          "/api/photos/upload",
          {
            method: "POST",
            body: JSON.stringify({ contentType, contentLength: file.size, fileName: file.name }),
          },
        );
        if (gen !== generation.current) {
          discardUpload(presign.uploadId);
          return null;
        }
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": presign.contentType },
        });
        if (gen !== generation.current) {
          discardUpload(presign.uploadId);
          return null;
        }
        if (!put.ok) throw new ApiRequestError("UPLOAD_FAILED", "The photo didn't upload. Try again.");
        uploadIdRef.current = presign.uploadId;
        await requestJson(`/api/photos/upload/${presign.uploadId}/prepare`, { method: "POST" });
        if (gen !== generation.current) {
          discardUpload(presign.uploadId);
          return null;
        }
        readyRef.current = true;
        return presign.uploadId;
      } catch (error) {
        if (gen !== generation.current) return null;
        const wrapped =
          error instanceof ApiRequestError
            ? error
            : new ApiRequestError("UPLOAD_FAILED", "The photo didn't upload. Try again.");
        failureRef.current = wrapped;
        setPhotoError(wrapped.message);
        return null;
      } finally {
        if (gen === generation.current) setUploading(false);
      }
    })();

    pipelineRef.current = task;
    return task;
  }

  async function waitUntilReady(): Promise<string> {
    const task = pipelineRef.current;
    if (!task) throw new ApiRequestError("UPLOAD_NOT_FOUND", "Choose a photo and try again.");
    const id = await task;
    if (!id) {
      throw failureRef.current ?? new ApiRequestError("UPLOAD_FAILED", "The photo didn't upload. Try again.");
    }
    return id;
  }

  useEffect(() => {
    if (active || keptRef.current) return;
    generation.current += 1;
    readyRef.current = false;
    const id = uploadIdRef.current;
    uploadIdRef.current = null;
    pipelineRef.current = null;
    if (id) discardUpload(id);
  }, [active]);

  useEffect(() => {
    function onLeave() {
      if (keptRef.current) return;
      const id = uploadIdRef.current;
      if (id) discardUpload(id);
    }
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      if (keptRef.current) return;
      const id = uploadIdRef.current;
      generation.current += 1;
      uploadIdRef.current = null;
      if (id) discardUpload(id);
    };
  }, []);

  return {
    uploading,
    photoError,
    isReady: () => readyRef.current,
    start,
    invalidate,
    keep,
    waitUntilReady,
    clearError: () => setPhotoError(null),
  };
}

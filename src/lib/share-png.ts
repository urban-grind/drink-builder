const PNG_PROBE = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

function probePng(): File {
  return new File([PNG_PROBE], "probe.png", { type: "image/png" });
}

/** Phones and tablets that can hand a PNG to the system sheet. Computers download. */
export function phoneSharesPng(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [probePng()] });
  } catch {
    return false;
  }
}

export function downloadPng(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function shareWasClosed(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error)) return false;
  const name = (error as { name: unknown }).name;
  return name === "AbortError" || name === "InvalidStateError";
}

/**
 * The tap that started rendering also starts the share. Pass only the PNG so
 * the phone sheet can save it to Photos or open Instagram. Closing the sheet
 * does not download.
 */
export async function deliverPng(blob: Blob, fileName: string, share: boolean): Promise<void> {
  if (!share) {
    downloadPng(blob, fileName);
    return;
  }
  const file = new File([blob], fileName, { type: "image/png" });
  try {
    await navigator.share({ files: [file] });
  } catch (error) {
    if (shareWasClosed(error)) return;
    throw new Error("The share sheet didn't open. Try again.");
  }
}

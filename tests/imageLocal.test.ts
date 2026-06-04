import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fileLastModifiedIso,
  getImageDimensions,
  sha256File
} from "../src/web/lib/imageLocal";

describe("local image helpers", () => {
  const originalImage = globalThis.Image;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = originalImage;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it("computes a SHA-256 hash in lowercase hex", async () => {
    const file = new File(["abc"], "synthetic.txt", {
      type: "text/plain",
      lastModified: 0
    });

    await expect(sha256File(file)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("formats File.lastModified as ISO", () => {
    const file = new File(["x"], "synthetic.txt", {
      lastModified: Date.UTC(2026, 5, 4, 12, 34, 56)
    });

    expect(fileLastModifiedIso(file)).toBe("2026-06-04T12:34:56.000Z");
  });

  it("reads image dimensions and revokes object URLs", async () => {
    const revokeObjectUrl = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:synthetic");
    URL.revokeObjectURL = revokeObjectUrl;

    class MockImage {
      naturalWidth = 2556;
      naturalHeight = 1179;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    globalThis.Image = MockImage as unknown as typeof Image;

    const file = new File(["<svg></svg>"], "synthetic.svg", {
      type: "image/svg+xml"
    });

    await expect(getImageDimensions(file)).resolves.toEqual({
      width: 2556,
      height: 1179
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:synthetic");
  });
});

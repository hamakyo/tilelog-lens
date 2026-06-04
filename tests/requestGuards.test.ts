import { describe, expect, it } from "vitest";
import { findForbiddenPayloadReason } from "../src/worker/middleware/requestGuards";

describe("request guards", () => {
  it("rejects top-level image-like keys", () => {
    for (const key of ["image", "screenshot", "file", "blob", "base64", "dataUrl"]) {
      expect(findForbiddenPayloadReason({ [key]: "x" })).toContain("not allowed");
    }
  });

  it("rejects nested inline image data URLs", () => {
    expect(
      findForbiddenPayloadReason({
        metadata: {
          note: "data:image/png;base64,aaaa"
        }
      })
    ).toContain("inline image payload");
  });

  it("accepts normal snapshot metadata keys", () => {
    expect(
      findForbiddenPayloadReason({
        source_image_sha256: "a".repeat(64),
        file_name: "screenshot.png",
        image_width: 1920
      })
    ).toBeNull();
  });
});

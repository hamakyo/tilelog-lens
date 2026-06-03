import { describe, expect, it } from "vitest";
import { findForbiddenPayloadReason } from "../src/worker/middleware/requestGuards";

describe("request guards", () => {
  it("rejects image-like keys", () => {
    expect(findForbiddenPayloadReason({ screenshot: "x" })).toContain(
      "not allowed"
    );
    expect(findForbiddenPayloadReason({ file: { name: "x" } })).toContain(
      "not allowed"
    );
  });

  it("rejects inline image data URLs", () => {
    expect(
      findForbiddenPayloadReason({
        note: "data:image/png;base64,aaaa"
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

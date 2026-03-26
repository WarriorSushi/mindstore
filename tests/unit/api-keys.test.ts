import { describe, expect, it } from "vitest";
import { getApiKeyFromHeaders, hashApiKeyValue } from "@/server/api-keys";

describe("api key helpers", () => {
  it("extracts bearer tokens from authorization headers", () => {
    const headers = new Headers({
      authorization: "Bearer msk_example_token",
    });

    expect(getApiKeyFromHeaders(headers)).toBe("msk_example_token");
  });

  it("falls back to explicit api key headers", () => {
    const headers = new Headers({
      "x-mindstore-token": "msk_extension_token",
    });

    expect(getApiKeyFromHeaders(headers)).toBe("msk_extension_token");
  });

  it("hashes api keys deterministically", () => {
    expect(hashApiKeyValue("msk_same_value")).toBe(hashApiKeyValue("msk_same_value"));
  });
});

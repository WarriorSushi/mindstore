import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy content-type enforcement", () => {
  it("allows form-encoded NextAuth sign-in posts", () => {
    const req = new NextRequest("https://mindstore.org/api/auth/signin/google", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "callbackUrl=%2Fapp&csrfToken=abc123",
    });

    const res = proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("still rejects unsupported API content types", async () => {
    const req = new NextRequest("https://mindstore.org/api/v1/import", {
      method: "POST",
      headers: {
        "content-type": "application/xml",
      },
      body: "<bad />",
    });

    const res = proxy(req);

    expect(res.status).toBe(415);
    await expect(res.json()).resolves.toEqual({ error: "Unsupported Content-Type" });
  });
});

/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MindStore — Your mind, searchable.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Teal glow top-left */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)",
          }}
        />
        {/* Sky glow bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: -120,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: 24,
            background: "linear-gradient(135deg, #14b8a6, #0284c7)",
            marginBottom: 32,
            boxShadow: "0 8px 32px rgba(20,184,166,0.3)",
          }}
        >
          <div
            style={{
              fontSize: 40,
              display: "flex",
            }}
          >
            🧠
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            textAlign: "center",
            display: "flex",
          }}
        >
          Your mind, searchable.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "#71717a",
            marginTop: 20,
            textAlign: "center",
            display: "flex",
            maxWidth: 700,
          }}
        >
          Import ChatGPT in 30 seconds · Ask anything · Get answers from your brain
        </div>

        {/* Bottom pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
          }}
        >
          {["Self-Hosted", "AI-Powered", "100% Private", "33 Plugins"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "8px 20px",
                borderRadius: 40,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#a1a1aa",
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 18,
            color: "#3f3f46",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          mindstore.org
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MindStore — Your AI-Powered Second Brain";
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

        {/* Logo Mark — inline SVG path as text art */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <svg
            width="72"
            height="72"
            viewBox="0 0 32 32"
            fill="none"
          >
            <defs>
              <linearGradient id="og-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
            </defs>
            <path
              d="M7 26 V12 Q7 6 12 6 Q16 6 16 13 Q16 6 20 6 Q25 6 25 12 V26"
              stroke="url(#og-g)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="13.5" r="2" fill="url(#og-g)" />
          </svg>
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
          Your AI-powered second brain.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "#71717a",
            marginTop: 20,
            textAlign: "center",
            display: "flex",
            maxWidth: 800,
          }}
        >
          Import from 12+ sources · Chat with your knowledge · 35 plugins · Free & open source
        </div>

        {/* Bottom pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
          }}
        >
          {["Self-Hosted", "AI-Powered", "100% Private", "35 Plugins", "MIT Licensed"].map((label) => (
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

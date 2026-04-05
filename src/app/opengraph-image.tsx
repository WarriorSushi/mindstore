/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MindStore — Your AI-Powered Second Brain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Static OG image for mindstore.org
 *
 * Design: Dark (#0a0a0b) base, teal+sky brand palette, Neural M logo,
 * subtle knowledge graph nodes in background, pill feature tags.
 * 1200×630 — Twitter large card + OG standard.
 *
 * Satori only supports flexbox — no grid, no clip-path, no backdrop-filter.
 */
export default async function OGImage() {
  // Network graph node positions — manually crafted to feel organic
  const nodes = [
    { x: 60,  y: 80,  r: 6,  o: 0.35 },
    { x: 140, y: 40,  r: 4,  o: 0.25 },
    { x: 220, y: 110, r: 5,  o: 0.30 },
    { x: 100, y: 170, r: 3,  o: 0.20 },
    { x: 300, y: 55,  r: 7,  o: 0.28 },
    { x: 380, y: 130, r: 4,  o: 0.22 },
    { x: 50,  y: 280, r: 5,  o: 0.18 },
    { x: 160, y: 310, r: 3,  o: 0.20 },
    // right side mirror
    { x: 1140, y: 80,  r: 6,  o: 0.35 },
    { x: 1060, y: 40,  r: 4,  o: 0.25 },
    { x: 980,  y: 110, r: 5,  o: 0.30 },
    { x: 1100, y: 170, r: 3,  o: 0.20 },
    { x: 900,  y: 55,  r: 7,  o: 0.28 },
    { x: 820,  y: 130, r: 4,  o: 0.22 },
    { x: 1150, y: 280, r: 5,  o: 0.18 },
    { x: 1040, y: 310, r: 3,  o: 0.20 },
    // bottom scatter
    { x: 80,  y: 540, r: 4,  o: 0.15 },
    { x: 200, y: 580, r: 3,  o: 0.12 },
    { x: 1000, y: 560, r: 4,  o: 0.15 },
    { x: 1120, y: 510, r: 5,  o: 0.18 },
  ];

  const edges = [
    [0, 1], [0, 3], [1, 2], [2, 4], [3, 7], [4, 5], [1, 4],
    [8, 9], [8, 11], [9, 10], [10, 12], [11, 15], [12, 13], [9, 12],
  ];

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
        {/* ── Ambient glows ── */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: -160,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -180,
            right: -140,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(14,165,233,0.10) 0%, transparent 65%)",
          }}
        />
        {/* centre soft glow behind logo */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            width: 340,
            height: 340,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)",
          }}
        />

        {/* ── Knowledge graph nodes ── */}
        <svg
          width="1200"
          height="630"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="edge-g" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          {/* edges */}
          {edges.map(([a, b], i) => (
            <line
              key={i}
              x1={nodes[a].x}
              y1={nodes[a].y}
              x2={nodes[b].x}
              y2={nodes[b].y}
              stroke="rgba(20,184,166,0.18)"
              strokeWidth="1"
            />
          ))}
          {/* nodes */}
          {nodes.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="#14b8a6"
              opacity={n.o}
            />
          ))}
        </svg>

        {/* ── Horizontal rule top ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.3) 30%, rgba(14,165,233,0.3) 70%, transparent 100%)",
          }}
        />

        {/* ── Content card ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            position: "relative",
          }}
        >
          {/* Logo mark — Neural M */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            <svg width="80" height="80" viewBox="0 0 32 32" fill="none">
              <defs>
                <linearGradient
                  id="logo-l"
                  x1="4"
                  y1="4"
                  x2="16"
                  y2="28"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#2dd4bf" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
                <linearGradient
                  id="logo-r"
                  x1="16"
                  y1="4"
                  x2="28"
                  y2="28"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
              {/* Left lobe */}
              <path
                d="M7 26 V13 Q7 6 11.5 6 Q15.5 6 16 12.5"
                stroke="url(#logo-l)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Right lobe */}
              <path
                d="M25 26 V13 Q25 6 20.5 6 Q16.5 6 16 12.5"
                stroke="url(#logo-r)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Synapse */}
              <circle cx="16" cy="13" r="2.5" fill="white" />
              <circle cx="15.2" cy="12.2" r="0.9" fill="white" opacity="0.5" />
            </svg>
          </div>

          {/* Word mark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              MindStore
            </span>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.04em",
              lineHeight: 1.08,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              maxWidth: 860,
            }}
          >
            <span>Your AI-powered</span>
            <span
              style={{
                color: "#14b8a6",
              }}
            >
              second brain.
            </span>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 22,
              color: "#71717a",
              marginTop: 22,
              textAlign: "center",
              display: "flex",
              maxWidth: 760,
              lineHeight: 1.5,
            }}
          >
            Import from ChatGPT, Kindle, YouTube &amp; Notion. Chat with your own
            knowledge. Discover hidden connections.
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 36,
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: 900,
            }}
          >
            {[
              "12+ Import Sources",
              "AI Chat",
              "35 Plugins",
              "MCP Protocol",
              "Free & Open Source",
            ].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "7px 18px",
                  borderRadius: 40,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#a1a1aa",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Domain footer ── */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#14b8a6",
              opacity: 0.7,
            }}
          />
          <span style={{ fontSize: 17, color: "#3f3f46", fontWeight: 500 }}>
            mindstore.org
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#0ea5e9",
              opacity: 0.5,
            }}
          />
        </div>

        {/* ── Bottom horizontal rule ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.2) 30%, rgba(20,184,166,0.2) 70%, transparent 100%)",
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}

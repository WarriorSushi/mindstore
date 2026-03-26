import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MindStore — Your mind, searchable.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0b',
          backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(20, 184, 166, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(56, 189, 248, 0.1) 0%, transparent 50%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #14b8a6, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
            }}
          >
            🧠
          </div>
          <span
            style={{
              fontSize: '36px',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            MindStore
          </span>
        </div>
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-0.03em',
            textAlign: 'center',
            lineHeight: 1.1,
            marginBottom: '20px',
          }}
        >
          Your mind, searchable.
        </div>
        <div
          style={{
            fontSize: '22px',
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.5,
          }}
        >
          Import your ChatGPT conversations. Ask anything. Get answers from your own brain.
        </div>
      </div>
    ),
    { ...size }
  );
}

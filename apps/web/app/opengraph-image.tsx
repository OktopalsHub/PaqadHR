import { ImageResponse } from 'next/og';

export const alt = 'PaqadHR: hire, pay, and support your team in one workspace';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '68px 76px',
        background: 'linear-gradient(135deg, #f5faf7 0%, #e7f3ed 52%, #eee9fb 100%)',
        color: '#173c32',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: '#173c32',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 25,
            fontWeight: 700,
          }}
        >
          P
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-1px' }}>PaqadHR</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 950 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: '#477866',
          }}
        >
          People operations, together
        </div>
        <div
          style={{
            fontSize: 66,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: '-3px',
          }}
        >
          Hire, pay, and support your team in one workspace.
        </div>
        <div style={{ fontSize: 26, color: '#536b61' }}>
          Recruitment · Payroll · Leave · Team recognition
        </div>
      </div>
      <div style={{ fontSize: 20, color: '#477866' }}>paqadhr.com</div>
    </div>,
    size,
  );
}

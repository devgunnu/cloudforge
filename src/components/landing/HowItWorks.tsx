const STEPS = [
  {
    number: '01',
    title: 'Draw',
    description: 'Drag Lambda, S3, RDS and more onto the canvas. Arrange your architecture visually.',
  },
  {
    number: '02',
    title: 'Configure',
    description: 'Set memory, runtime, region, and other properties in the live properties panel.',
  },
  {
    number: '03',
    title: 'Deploy',
    description: 'Claude generates Terraform HCL and provisions your AWS infrastructure in real time.',
  },
];

export default function HowItWorks() {
  return (
    <section
      style={{
        padding: '96px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Section label */}
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '11px',
          color: 'var(--cf-text-hint)',
          letterSpacing: '0.1em',
          marginBottom: '48px',
          textAlign: 'center',
        }}
      >
        // HOW IT WORKS
      </div>

      {/* Steps */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            style={{
              flex: '1 1 240px',
              display: 'flex',
              gap: '0',
              position: 'relative',
            }}
          >
            {/* Step content */}
            <div style={{ flex: 1, padding: '0 32px 0 0' }}>
              <div
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: '13px',
                  color: 'var(--cf-green)',
                  marginBottom: '8px',
                }}
              >
                {step.number} /
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '18px',
                  fontWeight: 500,
                  color: 'var(--cf-text-primary)',
                  marginBottom: '8px',
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '14px',
                  color: 'var(--cf-text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {step.description}
              </p>
            </div>

            {/* Connector (not on last) */}
            {i < STEPS.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  right: '0',
                  top: '10px',
                  width: '32px',
                  height: '1px',
                  borderTop: '1px dashed rgba(0,212,255,0.25)',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

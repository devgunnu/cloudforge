'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useForgeStore } from '@/store/forgeStore';

export default function ForgeDeployModal() {
  const { deployModalOpen, setDeployModalOpen, projectName, advanceStage, setStageStatus } =
    useForgeStore();
  const router = useRouter();

  function handleDeploy() {
    setDeployModalOpen(false);
    setStageStatus('deploy', 'processing');
    advanceStage();
    router.push('/app/deploy');
  }

  function handleCancel() {
    setDeployModalOpen(false);
  }

  return (
    <AnimatePresence>
      {deployModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleCancel}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 50,
            }}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.dialog
            key="modal"
            open
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              maxWidth: '440px',
              background: 'var(--lp-surface)',
              border: '0.5px solid var(--lp-border-hover)',
              borderRadius: '16px',
              padding: '28px',
              zIndex: 60,
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              margin: 0,
            }}
            aria-labelledby="deploy-modal-title"
            aria-describedby="deploy-modal-desc"
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(245,158,11,0.1)',
                  border: '0.5px solid rgba(245,158,11,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h2
                  id="deploy-modal-title"
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--lp-text-primary)',
                    letterSpacing: '-0.02em',
                    marginBottom: '4px',
                  }}
                >
                  Confirm AWS Deployment
                </h2>
                <p
                  id="deploy-modal-desc"
                  style={{
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '13px',
                    color: 'var(--lp-text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  This will provision real AWS resources in your account. You will
                  incur charges. Review the summary below before proceeding.
                </p>
              </div>
            </div>

            {/* Summary */}
            <div
              style={{
                background: 'var(--lp-elevated)',
                border: '0.5px solid var(--lp-border)',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '24px',
              }}
            >
              {[
                { label: 'Project', value: projectName },
                { label: 'Services', value: '5 AWS resources' },
                { label: 'Estimated cost', value: '~$32.70 / month' },
                { label: 'IAM roles', value: '2 roles' },
                { label: 'Region', value: 'us-east-1' },
                { label: 'Terraform state', value: 'S3 backend' },
              ].map(({ label, value }, i, arr) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom:
                      i < arr.length - 1 ? '0.5px solid var(--lp-border)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      fontSize: '12px',
                      color: 'var(--lp-text-secondary)',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: '12px',
                      color: 'var(--lp-text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--lp-border-hover)',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--lp-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                className="lp-btn-primary"
                style={{
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Deploy Now
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </motion.dialog>
        </>
      )}
    </AnimatePresence>
  );
}

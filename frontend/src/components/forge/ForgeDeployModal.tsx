'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
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

  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }, []);

  // Attach listener and auto-focus first button on open
  useEffect(() => {
    if (!deployModalOpen) return;
    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus the close button
    requestAnimationFrame(() => {
      const el = modalRef.current?.querySelector<HTMLElement>('button');
      el?.focus();
    });

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deployModalOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {deployModalOpen && (
        /* Full-screen flex container — centers modal and acts as backdrop */
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Modal — stop click from bubbling to backdrop */}
          <motion.div
            ref={modalRef}
            key="modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--lp-surface)',
              border: '0.5px solid var(--lp-border-hover)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              position: 'relative',
            }}
            aria-labelledby="deploy-modal-title"
            aria-describedby="deploy-modal-desc"
          >
            {/* X close button */}
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'transparent',
                border: '0.5px solid var(--lp-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--lp-text-hint)',
                transition: 'all 120ms ease',
              }}
            >
              <X size={13} />
            </button>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '20px',
                paddingRight: '32px',
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

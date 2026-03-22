'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Globe2, Clock, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useForgeStore } from '@/store/forgeStore';
import { useAuthStore } from '@/store/authStore';
import { useDemoStore } from '@/lib/demo/demoStore';
import { getDemoProjectList } from '@/lib/demo/demoService';
import type { Project, ProjectStage, ProjectStatus } from '@/lib/mock-data';
import type { ForgeStage } from '@/store/forgeStore';
import StatusBadge from '@/components/cloudforge/StatusBadge';

const DEMO_PROJECT_ID = 'demo-project-cloudforge-2024';

/** Mirrors the ApiProject → Project mapping in projectStore without importing internal types. */
function apiProjectToProject(p: ReturnType<typeof getDemoProjectList>[number]): Project {
  const now = Date.now();
  const updatedMs = new Date(p.updated_at).getTime();
  const diffMs = now - updatedMs;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  let updatedAt: string;
  if (diffMin < 60) {
    updatedAt = `${diffMin}m ago`;
  } else if (diffHr < 24) {
    updatedAt = `${diffHr}h ago`;
  } else {
    updatedAt = new Date(p.updated_at).toLocaleDateString();
  }
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    stage: p.stage as ProjectStage,
    status: p.status as ProjectStatus,
    region: p.region ?? 'us-east-1',
    updatedAt,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProjectCard({ project, index, onClick, onDelete, isDemo }: { project: Project; index: number; onClick?: () => void; onDelete?: () => void; isDemo?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      whileHover={{ y: -2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      style={{
        position: 'relative',
        background: 'var(--lp-surface)',
        border: `0.5px solid ${hovered ? 'var(--lp-border-hover)' : 'var(--lp-border)'}`,
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'border-color 150ms ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '180px',
      }}
      aria-label={`Project: ${project.name}, status: ${project.status}`}
    >
      {hovered && (
        <button
          type="button"
          aria-label={`Delete project ${project.name}`}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            color: deleteHovered ? 'var(--lp-error, #ef4444)' : 'var(--lp-text-hint)',
            transition: 'color 150ms ease',
            padding: 0,
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      )}

      {/* Top row: name + badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
            wordBreak: 'break-word',
          }}
        >
          {project.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isDemo && (
            <span
              aria-label="Demo project"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--lp-accent)',
                border: '1px solid var(--lp-accent)',
                borderRadius: '4px',
                padding: '2px 5px',
                lineHeight: 1,
              }}
            >
              DEMO
            </span>
          )}
          <StatusBadge status={project.status} size="sm" />
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '12px',
          color: 'var(--lp-text-secondary)',
          lineHeight: 1.55,
          marginTop: '8px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
        }}
      >
        {project.description}
      </p>

      {/* Bottom metadata */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '0.5px solid var(--lp-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            color: 'var(--lp-text-hint)',
          }}
        >
          <Globe2 size={11} aria-hidden="true" />
          {project.region}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            color: 'var(--lp-text-hint)',
          }}
        >
          <Clock size={11} aria-hidden="true" />
          {project.updatedAt}
        </span>
      </div>
    </motion.article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const OLD_STAGE_TO_FORGE: Record<string, ForgeStage> = {
  prd: 'requirements',
  arch: 'architecture',
  build: 'build',
  live: 'deploy',
};

export default function DashboardPage() {
  const { projects, loadProjects, createApiProject, deleteApiProject, isLoading, loadError } = useProjectStore();
  const { accessToken } = useAuthStore();
  const { setDemoMode } = useDemoStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === 'true';

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setDemoMode(true);
      const demoProjects = getDemoProjectList().map(apiProjectToProject);
      useProjectStore.setState({ projects: demoProjects, isLoading: false, loadError: null });
      return;
    }
    setDemoMode(false);
    if (accessToken) {
      loadProjects(accessToken);
    }
  }, [isDemo, accessToken, loadProjects, setDemoMode]);

  async function handleNewProject() {
    if (!accessToken) {
      setError('You must be logged in to create a project.');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const name = `project-${Date.now()}`;
      const project = await createApiProject(name, accessToken);
      useForgeStore.getState().setProjectName(project.name);
      useForgeStore.getState().setCurrentProjectId(project.id);
      useForgeStore.getState().setStageStatus('requirements', 'locked');
      useForgeStore.getState().setPrdText('');
      router.push(`/app/${project.id}/requirements`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!accessToken) return;
    setIsDeleting(true);
    try {
      await deleteApiProject(id, accessToken);
      setDeleteTarget(null);
    } catch {
      // stay open on error
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenProject(project: Project) {
    if (isDemo) {
      router.push(`/app/${DEMO_PROJECT_ID}/requirements?demo=true`);
      return;
    }
    useForgeStore.getState().setProjectName(project.name);
    useForgeStore.getState().setCurrentProjectId(project.id);
    useForgeStore.getState().hydrateProject(project.id);
    const forgeStage: ForgeStage = OLD_STAGE_TO_FORGE[project.stage] ?? 'requirements';
    router.push(`/app/${project.id}/${forgeStage}`);
  }

  if (isLoading && projects.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '14px', color: 'var(--lp-text-secondary)', padding: '32px 40px' }}>
        Loading...
      </p>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '32px 40px' }}>
        <p style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '14px', color: 'var(--lp-error, #ef4444)' }}>
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => accessToken && loadProjects(accessToken)}
          style={{ marginTop: '12px', fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '13px', color: 'var(--lp-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--lp-bg)',
        padding: '32px 40px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--lp-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Your projects
        </h1>

        <button
          type="button"
          className="lp-btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            opacity: isCreating ? 0.6 : 1,
            cursor: isCreating ? 'not-allowed' : 'pointer',
          }}
          aria-label="Create a new project"
          onClick={handleNewProject}
          disabled={isCreating}
        >
          <Plus size={14} aria-hidden="true" />
          {isCreating ? 'Creating…' : 'New project'}
        </button>
      </div>

      {isDemo && (
        <div
          role="status"
          style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(45,212,191,0.3)',
            background: 'rgba(45,212,191,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--lp-accent)',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '15px' }}>⚡</span>
          You are viewing a live demo. Click the E-Commerce Platform card to explore the full pipeline.
        </div>
      )}

      {error && (
        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: '12px',
            color: 'var(--lp-error, #ef4444)',
            marginTop: '8px',
          }}
        >
          {error}
        </p>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div style={{ marginTop: '48px' }}>
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--lp-text-primary)',
              marginBottom: '6px',
            }}
          >
            No projects yet
          </p>
          <p
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: '13px',
              color: 'var(--lp-text-secondary)',
            }}
          >
            Create your first project to get started.
          </p>
        </div>
      )}

      {/* Project grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px',
          marginTop: '32px',
        }}
        role="list"
        aria-label="Your projects"
      >
        {projects.map((project, i) => (
          <div key={project.id} role="listitem">
            <ProjectCard
              project={project}
              index={i}
              onClick={() => handleOpenProject(project)}
              onDelete={isDemo ? undefined : () => setDeleteTarget(project.id)}
              isDemo={isDemo && project.id === DEMO_PROJECT_ID}
            />
          </div>
        ))}

      </div>

      {deleteTarget !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: 'var(--lp-surface)',
              border: '1px solid var(--lp-border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              margin: '0 16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--lp-text-primary)',
                marginBottom: '8px',
              }}
            >
              Delete project?
            </p>
            <p
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: '13px',
                color: 'var(--lp-text-secondary)',
                marginBottom: '20px',
                lineHeight: 1.5,
              }}
            >
              This action cannot be undone. All project data will be permanently deleted.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid var(--lp-border)',
                  background: 'transparent',
                  color: 'var(--lp-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProject(deleteTarget)}
                disabled={isDeleting}
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

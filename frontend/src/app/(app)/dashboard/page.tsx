'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Globe2, Clock } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useForgeStore } from '@/store/forgeStore';
import type { Project } from '@/lib/mock-data';
import type { ForgeStage } from '@/store/forgeStore';
import StatusBadge from '@/components/cloudforge/StatusBadge';

// ── Sub-components ────────────────────────────────────────────────────────────

function ProjectCard({ project, index, onClick }: { project: Project; index: number; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);

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
        background: 'var(--lp-surface)',
        border: `0.5px solid ${hovered ? 'var(--lp-border-hover)' : 'var(--lp-border)'}`,
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'border-color 150ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
      aria-label={`Project: ${project.name}, status: ${project.status}`}
    >
      {/* Top row: name + badge */}
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
        <StatusBadge status={project.status} size="sm" />
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

function NewProjectCard({ index, onClick }: { index: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
        delay: index * 0.08,
      }}
      whileHover={{ y: -2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: 'transparent',
        border: `1px dashed ${hovered ? 'var(--lp-accent)' : 'var(--lp-border-hover)'}`,
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        minHeight: '160px',
        transition: 'border-color 150ms ease',
        width: '100%',
        textAlign: 'center',
      }}
      aria-label="Create a new project"
      type="button"
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: hovered ? 'var(--lp-accent)' : 'var(--lp-text-hint)',
          transition: 'color 150ms ease',
        }}
      >
        <Plus size={24} />
      </span>
      <span
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '13px',
          fontWeight: 500,
          color: hovered ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
          transition: 'color 150ms ease',
        }}
      >
        New project
      </span>
      <span
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          fontSize: '11px',
          color: 'var(--lp-text-hint)',
        }}
      >
        Start from a PRD or idea
      </span>
    </motion.button>
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
  const { projects } = useProjectStore();
  const router = useRouter();

  function handleNewProject() {
    useForgeStore.getState().setProjectName('New Project');
    useForgeStore.getState().setStageStatus('requirements', 'processing');
    router.push('/app/requirements');
  }

  function handleOpenProject(project: Project) {
    useForgeStore.getState().setProjectName(project.name);
    const forgeStage: ForgeStage = OLD_STAGE_TO_FORGE[project.stage] ?? 'requirements';
    router.push(`/app/${forgeStage}`);
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
          }}
          aria-label="Create a new project"
          onClick={handleNewProject}
        >
          <Plus size={14} aria-hidden="true" />
          New project
        </button>
      </div>

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
            />
          </div>
        ))}

        {/* Empty state / new project card */}
        <div role="listitem">
          <NewProjectCard index={projects.length} onClick={handleNewProject} />
        </div>
      </div>
    </div>
  );
}

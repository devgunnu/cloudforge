'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { DnDProvider } from './DnDContext';
import CanvasPane from './CanvasPane';
import NodePalette from '@/components/sidebar/NodePalette';
import Navbar from '@/components/navbar/Navbar';
import ConfigPanel from '@/components/panels/ConfigPanel';
import TopologyPreview from '@/components/panels/TopologyPreview';
import DeployLog from '@/components/panels/DeployLog';
import { useCanvasStore } from '@/store/canvasStore';

function CloudForgeLayout() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const showTopologyPreview = useCanvasStore((s) => s.showTopologyPreview);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cf-bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* Navbar */}
      <Navbar />

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left sidebar */}
        <NodePalette />

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <CanvasPane />

          {/* Config panel (absolute, slides from right) */}
          {selectedNodeId && <ConfigPanel nodeId={selectedNodeId} />}

          {/* Deploy log overlay */}
          <DeployLog />
        </div>
      </div>

      {/* Bottom topology preview strip */}
      {showTopologyPreview && <TopologyPreview />}
    </div>
  );
}

export default function CloudCanvas() {
  return (
    <ReactFlowProvider>
      <DnDProvider>
        <CloudForgeLayout />
      </DnDProvider>
    </ReactFlowProvider>
  );
}

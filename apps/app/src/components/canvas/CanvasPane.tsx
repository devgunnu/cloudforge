'use client';

import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '@/store/canvasStore';
import { nodeTypes } from '@/components/nodes/nodeTypes';
import { awsServices } from '@/lib/awsServices';
import { useDnD } from './DnDContext';

// Default edge styling applied to all new edges
const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  style: { stroke: 'var(--cf-cyan)', strokeWidth: 1.5, opacity: 0.5 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: 'var(--cf-cyan)',
  },
};

export default function CanvasPane() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const addNode = useCanvasStore((s) => s.addNode);
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode);
  const [dndType] = useDnD();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!dndType) return;
      const service = awsServices[dndType];
      if (!service) return;

      // Get the ReactFlow wrapper element to calculate position
      const reactFlowWrapper = event.currentTarget as HTMLElement;
      const rect = reactFlowWrapper.getBoundingClientRect();

      // We approximate position since we can't call useReactFlow here
      // CanvasPane is inside ReactFlowProvider so we use the DOM rect
      const position = {
        x: event.clientX - rect.left - 100,
        y: event.clientY - rect.top - 40,
      };

      addNode({
        id: `node_${Date.now()}`,
        type: 'awsNode',
        position,
        data: {
          serviceId: dndType,
          label: service.label,
          config: { ...service.defaultConfig },
        },
      });
    },
    [dndType, addNode]
  );

  const styledEdges = edges.map((edge: Edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const sourceServiceId = sourceNode
      ? (sourceNode.data as { serviceId: string }).serviceId
      : '';
    const isAnimated =
      sourceServiceId === 'lambda' || sourceServiceId === 'sns';
    return {
      ...edge,
      animated: isAnimated,
      style: {
        stroke: isAnimated ? 'var(--cf-green)' : 'var(--cf-cyan)',
        strokeWidth: 1.5,
        opacity: 0.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isAnimated ? 'var(--cf-green)' : 'var(--cf-cyan)',
      },
    };
  });

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneClick={() => setSelectedNode(null)}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{
          background: 'var(--cf-bg-base)',
        }}
        deleteKeyCode="Delete"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#1e2640"
          gap={20}
          size={1}
        />
        <Controls
          style={{
            background: 'var(--cf-bg-surface)',
            border: '0.5px solid var(--cf-border)',
            borderRadius: '8px',
          }}
        />
        <MiniMap
          nodeColor={() => '#1e2640'}
          maskColor="rgba(10,14,26,0.8)"
          style={{
            background: '#12172b',
            border: '0.5px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  );
}

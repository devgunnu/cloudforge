// ============================================================
// Deploy API route — proxies to FastAPI backend.
//
// POST /api/deploy       → Start deployment, returns { deploymentId, status }
// GET  /api/deploy?id=X  → SSE proxy stream from backend
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.CLOUDFORGE_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Map frontend topology/architecture format to backend schema
    const payload = {
      architecture_data: {
        nodes: body.architectureData?.nodes || body.nodes || [],
        edges: body.architectureData?.edges || body.edges || [],
      },
      project_name: body.projectName || body.project_name || 'cloudforge-project',
      region: body.region || 'us-east-1',
      environment: body.environment || 'prod',
      aws_credentials: body.awsCredentials || null,
    };

    const backendRes = await fetch(`${BACKEND_URL}/deploy/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!backendRes.ok) {
      const error = await backendRes.text();
      return NextResponse.json(
        { error: 'Backend deployment failed', detail: error },
        { status: backendRes.status },
      );
    }

    const data = await backendRes.json();
    return NextResponse.json({
      deploymentId: data.deployment_id,
      status: data.status,
      message: data.message,
    });
  } catch (error) {
    // Fallback: if backend is unreachable, return a mock response for dev
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CloudForge] Backend unreachable, returning mock response');
      return NextResponse.json({
        deploymentId: `dep_mock_${Date.now()}`,
        status: 'accepted',
        message: 'Mock deployment (backend unavailable)',
        mock: true,
      });
    }

    return NextResponse.json(
      { error: 'Failed to connect to deployment backend' },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const deploymentId = request.nextUrl.searchParams.get('id');

  if (!deploymentId) {
    return NextResponse.json(
      { error: 'Missing deployment id query parameter' },
      { status: 400 },
    );
  }

  try {
    // Proxy the SSE stream from the backend
    const backendRes = await fetch(
      `${BACKEND_URL}/deploy/${deploymentId}/stream`,
      {
        headers: { Accept: 'text/event-stream' },
      },
    );

    if (!backendRes.ok || !backendRes.body) {
      return NextResponse.json(
        { error: 'Failed to connect to deployment stream' },
        { status: backendRes.status },
      );
    }

    // Forward the SSE stream
    return new Response(backendRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to deployment backend' },
      { status: 502 },
    );
  }
}

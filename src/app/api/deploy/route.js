import { NextResponse } from 'next/server';

const VERCEL_DEPLOYMENTS_ENDPOINT = 'https://api.vercel.com/v13/deployments';

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .map((file) => {
      const path = typeof file?.file === 'string' ? file.file : '';
      const data = typeof file?.data === 'string' ? file.data : '';
      const normalizedPath = path.replace(/^\/+/, '').trim();
      return normalizedPath ? { file: normalizedPath, data } : null;
    })
    .filter(Boolean);
}

function extractVercelErrorMessage(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    return parsed?.error?.message || parsed?.error || parsed?.message || responseText;
  } catch {
    return responseText;
  }
}

export async function POST(request) {
  try {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Server is missing VERCEL_TOKEN.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const projectName = typeof body?.projectName === 'string' ? body.projectName.trim() : '';
    const framework = body?.framework ?? null;
    const files = normalizeFiles(body?.files);

    if (!projectName) {
      return NextResponse.json(
        { error: 'Project name is required.' },
        { status: 400 }
      );
    }

    if (!files.length) {
      return NextResponse.json(
        { error: 'At least one file is required for deployment.' },
        { status: 400 }
      );
    }

    const payload = {
      name: projectName,
      files,
      projectSettings: {
        framework,
      },
    };

    const response = await fetch(VERCEL_DEPLOYMENTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Vercel deployment failed: ${extractVercelErrorMessage(responseText)}`,
        },
        { status: response.status }
      );
    }

    const data = responseText ? JSON.parse(responseText) : {};
    const url = data?.url || data?.deployment?.url || '';

    return NextResponse.json({
      url,
      deploymentId: data?.id || data?.deployment?.id || null,
      readyState: data?.readyState || null,
    });
  } catch (error) {
    console.error('Vercel deploy route error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Unexpected deployment error.',
      },
      { status: 500 }
    );
  }
}

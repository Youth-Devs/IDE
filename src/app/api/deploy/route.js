import { NextResponse } from 'next/server';

const API_BASE = 'https://api.vercel.com';

function isCustomDomainEnabled(overrideValue) {
  if (overrideValue === true || overrideValue === false) {
    return overrideValue;
  }
  return String(process.env.USE_CUSTOM_DOMAIN).toLowerCase() === 'true';
}

function slugifyProjectName(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

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

function extractErrorMessage(payload) {
  if (!payload) return 'Unknown Vercel error.';
  if (typeof payload === 'string') return payload;
  return (
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    JSON.stringify(payload)
  );
}

async function vercelRequest(token, path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const error = new Error(extractErrorMessage(json));
    error.status = response.status;
    error.payload = json;
    throw error;
  }

  return json;
}

async function findExistingProject(token, projectName) {
  const data = await vercelRequest(token, `/v9/projects`);
  const projects = Array.isArray(data?.projects) ? data.projects : Array.isArray(data) ? data : [];
  return projects.find((project) => project?.name === projectName) || null;
}

async function ensureProject(token, projectName, useCustomDomain, aliasDomain) {
  const existingProject = await findExistingProject(token, projectName);
  if (existingProject) {
    return existingProject;
  }

  const createdProject = await vercelRequest(token, `/v9/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      framework: null,
      ...(useCustomDomain ? { alias: aliasDomain } : {}),
    }),
  });

  return createdProject;
}

async function ensureProjectDomain(token, projectId, aliasDomain) {
  if (!aliasDomain) return null;

  try {
    return await vercelRequest(token, `/v9/projects/${projectId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: aliasDomain }),
    });
  } catch (error) {
    if (error.status === 409) {
      return { alreadyExists: true };
    }
    throw error;
  }
}

async function createDeployment(token, { projectName, files, aliasDomain, useCustomDomain }) {
  const payload = {
    name: projectName,
    files,
    projectSettings: {
      framework: null,
    },
  };

  if (useCustomDomain && aliasDomain) {
    payload.alias = aliasDomain;
  }

  return vercelRequest(token, `/v13/deployments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function POST(request) {
  try {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Server is missing VERCEL_TOKEN.' }, { status: 500 });
    }

    const body = await request.json();
    const useCustomDomain = isCustomDomainEnabled(body?.useCustomDomain);
    const requestedName = typeof body?.projectName === 'string' ? body.projectName.trim() : '';
    const slug = slugifyProjectName(requestedName);
    const projectName = slug || 'hackathon-project';
    const aliasDomain = useCustomDomain ? `${projectName}.youthdevs.me` : `${projectName}.vercel.app`;
    const files = normalizeFiles(body?.files);

    if (!files.length) {
      return NextResponse.json({ error: 'At least one file is required for deployment.' }, { status: 400 });
    }

    const project = await ensureProject(token, projectName, useCustomDomain, aliasDomain);
    const projectId = project?.id || project?.projectId || null;

    if (!projectId) {
      return NextResponse.json({ error: 'Vercel project lookup succeeded, but no projectId was returned.' }, { status: 500 });
    }

    if (useCustomDomain) {
      await ensureProjectDomain(token, projectId, aliasDomain);
    }

    await createDeployment(token, {
      projectName,
      files,
      aliasDomain,
      useCustomDomain,
    });

    return NextResponse.json({
      url: `https://${aliasDomain}`,
      projectId,
      projectName,
      domainMode: useCustomDomain ? 'custom' : 'vercel',
    });
  } catch (error) {
    console.error('Vercel deploy route error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unexpected deployment error.' },
      { status: error?.status || 500 }
    );
  }
}

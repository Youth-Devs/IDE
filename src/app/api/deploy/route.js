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

function detectFramework(files, requestedFramework) {
  const explicitFramework = String(requestedFramework || '').toLowerCase();
  if (explicitFramework === 'nextjs') {
    return 'nextjs';
  }

  const packageJsonFile = files.find((file) => file.file === 'package.json');
  if (packageJsonFile?.data) {
    try {
      const packageJson = JSON.parse(packageJsonFile.data);
      const dependencyBuckets = [
        packageJson.dependencies,
        packageJson.devDependencies,
        packageJson.peerDependencies,
        packageJson.optionalDependencies,
      ].filter(Boolean);

      const hasNextDependency = dependencyBuckets.some((bucket) => Boolean(bucket.next));
      const nextScripts = ['dev', 'build', 'start'].some((scriptName) => {
        const script = packageJson.scripts?.[scriptName];
        return typeof script === 'string' && /\bnext\b/.test(script);
      });

      if (hasNextDependency || nextScripts) {
        return 'nextjs';
      }
    } catch {
      // Ignore malformed package.json and fall back to file-based detection.
    }
  }

  const hasNextAppStructure = files.some((file) =>
    /^app\/layout\.(js|jsx|ts|tsx)$/.test(file.file) ||
    /^app\/page\.(js|jsx|ts|tsx)$/.test(file.file) ||
    /^pages\/_app\.(js|jsx|ts|tsx)$/.test(file.file) ||
    /^pages\/index\.(js|jsx|ts|tsx)$/.test(file.file) ||
    /^next\.config\.(js|mjs|cjs|ts)$/.test(file.file)
  );

  return hasNextAppStructure ? 'nextjs' : null;
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

async function ensureProject(token, projectName, useCustomDomain, aliasDomain, framework) {
  const existingProject = await findExistingProject(token, projectName);
  if (existingProject) {
    return existingProject;
  }

  const createdProject = await vercelRequest(token, `/v9/projects`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      framework,
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

async function createDeployment(token, { projectName, files, aliasDomain, useCustomDomain, framework }) {
  const payload = {
    name: projectName,
    files,
    projectSettings: {
      framework,
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

async function ensureProjectAlias(token, deploymentId, aliasDomain) {
  if (!deploymentId || !aliasDomain) return null;

  try {
    return await vercelRequest(token, `/v2/deployments/${deploymentId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias: aliasDomain }),
    });
  } catch (error) {
    if (error.status === 409) {
      return { alreadyExists: true };
    }
    throw error;
  }
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
    const framework = detectFramework(files, body?.framework);

    if (!files.length) {
      return NextResponse.json({ error: 'At least one file is required for deployment.' }, { status: 400 });
    }

    const project = await ensureProject(token, projectName, useCustomDomain, aliasDomain, framework);
    const projectId = project?.id || project?.projectId || null;

    if (!projectId) {
      return NextResponse.json({ error: 'Vercel project lookup succeeded, but no projectId was returned.' }, { status: 500 });
    }

    if (useCustomDomain) {
      await ensureProjectDomain(token, projectId, aliasDomain);
    }

    const deployment = await createDeployment(token, {
      projectName,
      files,
      aliasDomain,
      useCustomDomain,
      framework,
    });

    const deploymentId = deployment?.id || deployment?.uid || deployment?.deployment?.id || deployment?.deployment?.uid || null;
    const deploymentUrl = deployment?.url ? `https://${deployment.url}` : '';
    const resolvedUrl = deploymentUrl || `https://${aliasDomain}`;

    if (useCustomDomain && deploymentId && aliasDomain) {
      try {
        await ensureProjectAlias(token, deploymentId, aliasDomain);
      } catch (aliasError) {
        console.warn('Vercel alias assignment failed:', aliasError?.message || aliasError);
      }
    }

    return NextResponse.json({
      url: resolvedUrl,
      deploymentUrl: deploymentUrl || resolvedUrl,
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

import { spawn } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const PREVIEW_PORT = 4173;
const PREVIEW_DIR = path.join(process.cwd(), '.next-preview-workspace');
const NEXT_CLI_PATH = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const isHostedRuntime = () => Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const getPreviewState = () => {
  if (!globalThis.__youthdevsNextPreview) {
    globalThis.__youthdevsNextPreview = { process: null };
  }
  return globalThis.__youthdevsNextPreview;
};

const stopPreviewProcess = async (previewState) => {
  const activeProcess = previewState.process;
  if (!activeProcess || activeProcess.killed || activeProcess.exitCode !== null) {
    previewState.process = null;
    return;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1500);
    activeProcess.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    try {
      activeProcess.kill();
    } catch {
      resolve();
    }
  });

  previewState.process = null;
};

const safeFilePath = (fileName) => {
  const normalizedName = String(fileName || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const targetPath = path.join(PREVIEW_DIR, normalizedName);
  const relativePath = path.relative(PREVIEW_DIR, targetPath);

  if (!normalizedName || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return targetPath;
};

const waitForPreviewServer = async () => {
  const healthUrl = `http://localhost:${PREVIEW_PORT}`;
  const browserUrl = `http://127.0.0.1:${PREVIEW_PORT}`;

  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(healthUrl, { cache: 'no-store' });
      if (response.status < 500) {
        return browserUrl;
      }
    } catch {
      // The dev server is still booting.
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Next.js preview did not respond at ${healthUrl}.`);
};

export async function POST(request) {
  try {
    const { files } = await request.json();
    const sourceFiles = Array.isArray(files) ? files : [];

    if (sourceFiles.length === 0) {
      return NextResponse.json({ error: 'No files were provided for the Next.js preview.' }, { status: 400 });
    }

    if (isHostedRuntime()) {
      return NextResponse.json({
        error: 'Next.js live preview requires running the IDE locally. Deployed/serverless hosts are read-only and cannot run a long-lived npm run dev server for the iframe.'
      }, { status: 501 });
    }

    const previewState = getPreviewState();
    await stopPreviewProcess(previewState);

    await rm(PREVIEW_DIR, { recursive: true, force: true });
    await mkdir(PREVIEW_DIR, { recursive: true });

    let hasPackageJson = false;
    for (const file of sourceFiles) {
      const targetPath = safeFilePath(file.name);
      if (!targetPath) continue;

      if (String(file.name).replace(/\\/g, '/').toLowerCase() === 'package.json') {
        hasPackageJson = true;
      }

      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file.content || '', 'utf8');
    }

    if (!hasPackageJson) {
      await writeFile(
        path.join(PREVIEW_DIR, 'package.json'),
        JSON.stringify({
          scripts: { dev: 'next dev' },
          dependencies: {
            next: '14.2.3',
            react: '^18.3.1',
            'react-dom': '^18.3.1'
          },
          devDependencies: {}
        }, null, 2),
        'utf8'
      );
    }

    previewState.process = spawn(process.execPath, [NEXT_CLI_PATH, 'dev', '--port', String(PREVIEW_PORT)], {
      cwd: PREVIEW_DIR,
      env: { ...process.env, PORT: String(PREVIEW_PORT) },
      stdio: 'ignore',
      detached: false
    });

    previewState.process.on('exit', () => {
      if (previewState.process) {
        previewState.process = null;
      }
    });

    const url = await waitForPreviewServer();
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Next preview server failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to start Next.js preview.' }, { status: 500 });
  }
}

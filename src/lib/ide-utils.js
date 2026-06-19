export const DEMO_INDEX_HTML = (title, subtitle) => `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-white min-h-screen flex items-center justify-center">
  <div class="text-center p-6 bg-slate-800 rounded-xl border border-indigo-500/20">
    <h1 class="text-2xl font-bold text-indigo-400">${title}</h1>
    <p class="text-xs text-slate-400 mt-2 font-mono">${subtitle}</p>
  </div>
</body>
</html>`;

export const decodeBase64Utf8 = (str) => {
  try {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    try {
      return atob(str);
    } catch (err) {
      return '';
    }
  }
};

export const filesAreIdentical = (arr1, arr2) => {
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  return arr1.every((f1) => {
    const f2 = arr2.find((f) => f.name === f1.name);
    return f2 && f2.content === f1.content;
  });
};

export const buildVercelFilesPayload = (workspaceFiles) =>
  workspaceFiles
    .map((file) => {
      const rawPath = file.path || file.name || '';
      const normalizedPath = String(rawPath).replace(/^\/+/, '');
      return {
        file: normalizedPath,
        data: typeof file.content === 'string' ? file.content : '',
      };
    })
    .filter((file) => file.file);

export const formatTime = (secs) => {
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
};

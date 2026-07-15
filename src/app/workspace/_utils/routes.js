export const WORKSPACE_PATH = '/workspace';
export const LOGIN_PATH = '/login';
export const ADMIN_PATH = '/admin';

export function getWorkspaceRouteState(pathname) {
  let routePath = String(pathname || '/').replace(/^\/+/, '');
  try {
    routePath = decodeURIComponent(routePath);
  } catch {
    // A malformed URL is not a project slug. Keep it out of the project route.
    routePath = '__invalid_path__';
  }
  const routeSegments = routePath.split('/').filter(Boolean);
  const routeMode =
    routePath === '' ? 'root' :
    routePath === 'workspace' ? 'workspace' :
    routePath === 'login' ? 'login' :
    routePath === 'admin' ? 'admin' :
    routeSegments[0] === 'admin' && routeSegments.length === 2 ? 'admin-project' :
    routeSegments.length === 1 ? 'project' :
    'invalid';

  const isAdminRoute = routeMode === 'admin' || routeMode === 'admin-project';
  const projectSlugFromRoute =
    routeMode === 'project' ? (routeSegments[0] || '') :
    routeMode === 'admin-project' ? (routeSegments[1] || '') :
    '';

  return {
    routePath,
    routeSegments,
    routeMode,
    isAdminRoute,
    projectSlugFromRoute,
  };
}

export function buildWorkspaceProjectPath(slug) {
  return `/${encodeURIComponent(String(slug || '').replace(/^\/+/, ''))}`;
}

export function buildAdminProjectPath(slug) {
  return `/admin/${encodeURIComponent(String(slug || '').replace(/^\/+/, ''))}`;
}

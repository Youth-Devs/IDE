export const WORKSPACE_PATH = '/workspace';
export const LOGIN_PATH = '/login';
export const ADMIN_PATH = '/admin';

export function getWorkspaceRouteState(pathname) {
  const routePath = decodeURIComponent(String(pathname || '/').replace(/^\/+/, ''));
  const routeSegments = routePath.split('/').filter(Boolean);
  const routeMode =
    routePath === '' ? 'root' :
    routePath === 'workspace' ? 'workspace' :
    routePath === 'login' ? 'login' :
    routePath === 'admin' ? 'admin' :
    routeSegments[0] === 'admin' && routeSegments[1] ? 'admin-project' :
    'project';

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
  return `/${String(slug || '').replace(/^\/+/, '')}`;
}

export function buildAdminProjectPath(slug) {
  return `/admin/${String(slug || '').replace(/^\/+/, '')}`;
}

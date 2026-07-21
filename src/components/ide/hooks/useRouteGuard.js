import { useEffect } from 'react';
import { LOGIN_PATH, WORKSPACE_PATH } from '../../../app/workspace/_utils/routes';

export default function useRouteGuard({
  authLoading,
  pathname,
  routeMode,
  user,
  router,
  currentProjectId,
  setCurrentProjectId,
  isAdminRoute,
  adminLoading,
  canAccessAdminPanel,
  adminSubmissionsResolved,
  routeProject,
}) {
  useEffect(() => {
    if (authLoading) return;

    const replace = (target) => {
      if (pathname !== target) router.replace(target);
    };
    const clearActiveProject = () => {
      if (currentProjectId) setCurrentProjectId(null);
      sessionStorage.removeItem('current-project-id');
    };

    if (routeMode === 'root' || routeMode === 'invalid') {
      replace(user ? WORKSPACE_PATH : LOGIN_PATH);
      return;
    }
    if (routeMode === 'login') {
      clearActiveProject();
      if (user) replace(WORKSPACE_PATH);
      return;
    }
    if (!user) {
      const nextPath = pathname && pathname !== LOGIN_PATH
        ? `${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`
        : LOGIN_PATH;
      replace(nextPath);
      return;
    }
    if (routeMode === 'workspace') {
      clearActiveProject();
      return;
    }
    if (isAdminRoute) {
      if (adminLoading) return;
      if (!canAccessAdminPanel) {
        replace(WORKSPACE_PATH);
        return;
      }
      clearActiveProject();
      if (routeMode === 'admin-project' && adminSubmissionsResolved && !routeProject) replace('/admin');
    }
  }, [adminLoading, adminSubmissionsResolved, authLoading, canAccessAdminPanel, currentProjectId, isAdminRoute, pathname, routeMode, routeProject, router, setCurrentProjectId, user]);
}

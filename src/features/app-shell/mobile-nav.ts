const coachRoot = "/coach";
const coachPagesWithTabs = new Set(["/coach/equipe"]);

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function mobileTabBarVisible(pathname: string) {
  if (!pathname.startsWith(`${coachRoot}/`)) return true;
  return coachPagesWithTabs.has(pathname.replace(/\/$/, ""));
}

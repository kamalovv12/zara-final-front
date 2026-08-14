// Central place that decides which "home" a logged-in user is locked into.
// Approved sellers, couriers, and admins/moderators are pinned to their own
// operational panel and never fall back into the buyer (tabs) experience.
export type HomeRoute = "/seller" | "/courier" | "/admin" | "/(tabs)/home";

export function lockedRole(user: any): "seller" | "courier" | "admin" | null {
  if (!user) return null;
  if (user.role === "admin" || user.role === "moderator") return "admin";
  if (user.role === "courier") return "courier";
  if (user.seller_info?.approved) return "seller";
  return null;
}

export function homeRouteFor(user: any): HomeRoute {
  const role = lockedRole(user);
  if (role === "admin") return "/admin";
  if (role === "courier") return "/courier";
  if (role === "seller") return "/seller";
  return "/(tabs)/home";
}

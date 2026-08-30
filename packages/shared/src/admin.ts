export type AdminRole = "OWNER" | "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "SUPPORT" | "user";

export type AdminPermission =
  | "USERS_VIEW"
  | "USERS_SUSPEND"
  | "USERS_BAN"
  | "USERS_UNBAN"
  | "MATCHES_VIEW"
  | "MATCHES_VOID"
  | "MATCHES_CANCEL"
  | "MATCHES_FORFEIT"
  | "MATCHES_REFUND"
  | "WALLET_VIEW"
  | "WALLET_GRANT_COINS"
  | "WALLET_GRANT_DIAMONDS"
  | "WALLET_REFUND"
  | "WALLET_REVERSE_TRANSACTION"
  | "ADMIN_VIEW_AUDIT"
  | "ADMIN_MANAGE_ADMINS"
  // Canonical lowercase aliases
  | "users.view"
  | "users.suspend"
  | "users.ban"
  | "users.unban"
  | "matches.view"
  | "matches.void"
  | "matches.cancel"
  | "matches.terminate"
  | "matches.force_resolve"
  | "wallet.view"
  | "wallet.grant_coins"
  | "wallet.grant_diamonds"
  | "wallet.refund"
  | "wallet.reverse_transaction"
  | "audit.view"
  | "system.view"
  | "admins.manage"
  | "permissions.manage";

export const PERMISSION_ALIAS_MAP: Record<string, AdminPermission> = {
  "users.view": "USERS_VIEW",
  "users.suspend": "USERS_SUSPEND",
  "users.ban": "USERS_BAN",
  "users.unban": "USERS_UNBAN",
  "matches.view": "MATCHES_VIEW",
  "matches.void": "MATCHES_VOID",
  "matches.cancel": "MATCHES_CANCEL",
  "matches.terminate": "MATCHES_VOID",
  "matches.force_resolve": "MATCHES_VOID",
  "wallet.view": "WALLET_VIEW",
  "wallet.grant_coins": "WALLET_GRANT_COINS",
  "wallet.grant_diamonds": "WALLET_GRANT_DIAMONDS",
  "wallet.refund": "WALLET_REFUND",
  "wallet.reverse_transaction": "WALLET_REVERSE_TRANSACTION",
  "audit.view": "ADMIN_VIEW_AUDIT",
  "system.view": "ADMIN_VIEW_AUDIT",
  "admins.manage": "ADMIN_MANAGE_ADMINS",
  "permissions.manage": "ADMIN_MANAGE_ADMINS",
};

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  "USERS_VIEW",
  "USERS_SUSPEND",
  "USERS_BAN",
  "USERS_UNBAN",
  "MATCHES_VIEW",
  "MATCHES_VOID",
  "MATCHES_CANCEL",
  "MATCHES_FORFEIT",
  "MATCHES_REFUND",
  "WALLET_VIEW",
  "WALLET_GRANT_COINS",
  "WALLET_GRANT_DIAMONDS",
  "WALLET_REFUND",
  "WALLET_REVERSE_TRANSACTION",
  "ADMIN_VIEW_AUDIT",
  "ADMIN_MANAGE_ADMINS",
];

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  OWNER: ALL_ADMIN_PERMISSIONS,
  SUPER_ADMIN: ALL_ADMIN_PERMISSIONS,
  ADMIN: ALL_ADMIN_PERMISSIONS.filter((p) => p !== "ADMIN_MANAGE_ADMINS"),
  MODERATOR: [
    "USERS_VIEW",
    "USERS_SUSPEND",
    "MATCHES_VIEW",
    "MATCHES_VOID",
    "MATCHES_CANCEL",
    "MATCHES_FORFEIT",
    "ADMIN_VIEW_AUDIT",
  ],
  SUPPORT: ["USERS_VIEW", "MATCHES_VIEW", "WALLET_VIEW", "ADMIN_VIEW_AUDIT"],
  user: [],
};

export function hasPermission(role: string, permission: AdminPermission): boolean {
  const normalizedRole = (role in ROLE_PERMISSIONS ? role : "user") as AdminRole;
  const canonicalPermission = PERMISSION_ALIAS_MAP[permission] ?? permission;
  return ROLE_PERMISSIONS[normalizedRole]?.includes(canonicalPermission) ?? false;
}

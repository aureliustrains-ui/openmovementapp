/** Owner (head coach) and coaches may use the admin area. */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === "Admin" || role === "Coach";
}

/** Only the owner manages coaches and sees every client. */
export function isOwnerRole(role: string | null | undefined): boolean {
  return role === "Admin";
}

export type UserRole = "admin" | "rep" | "installer" | "electrician";

/** Roles that work in the field (no access to the rep/admin side of the app). */
export function isFieldRole(role: UserRole): role is "installer" | "electrician" {
  return role === "installer" || role === "electrician";
}

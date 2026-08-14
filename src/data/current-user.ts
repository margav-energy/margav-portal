export interface CurrentUser {
  firstName: string;
  initials: string;
  teamMemberCount: number;
}

// Placeholder signed-in user for the mock-data v1. Swap for real session data
// once auth is wired up.
export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    firstName: "Ella",
    initials: "E",
    teamMemberCount: 1,
  };
}

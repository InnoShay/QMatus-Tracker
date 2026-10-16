/**
 * Development/test identities. Fictional people on the reserved `.test` domain.
 * The shared password is a local-only test value (never used outside a local
 * Supabase stack; seed refuses to run against a non-local URL).
 */
export const DEV_PASSWORD = process.env.SEED_PASSWORD ?? "qmatus-local-dev-only";

export type FixtureUser = {
  key: string;
  email: string;
  name: string;
  title: string;
  orgRole: "owner" | "admin" | "member";
  /** Team memberships: team key -> role. */
  teams: Partial<Record<"founders" | "dev", "lead" | "member">>;
  level?: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
};

export const USERS = {
  owner: {
    key: "owner",
    email: "rhea@qmatus.test",
    name: "Rhea Kapoor",
    title: "Co-founder, CEO",
    orgRole: "owner",
    teams: { founders: "lead" },
    level: "L5",
  },
  founder: {
    key: "founder",
    email: "iris@qmatus.test",
    name: "Iris Chen",
    title: "Co-founder, Product",
    orgRole: "member",
    teams: { founders: "member" },
    level: "L5",
  },
  admin: {
    key: "admin",
    email: "sam@qmatus.test",
    name: "Sam Ortiz",
    title: "Operations",
    orgRole: "admin",
    teams: {},
  },
  devLead: {
    key: "devLead",
    email: "priya@qmatus.test",
    name: "Priya Nair",
    title: "Engineering Lead",
    orgRole: "member",
    teams: { dev: "lead" },
    level: "L4",
  },
  dev: {
    key: "dev",
    email: "leo@qmatus.test",
    name: "Leo Martins",
    title: "Software Engineer",
    orgRole: "member",
    teams: { dev: "member" },
    level: "L2",
  },
  dev2: {
    key: "dev2",
    email: "ada@qmatus.test",
    name: "Ada Okafor",
    title: "Software Engineer",
    orgRole: "member",
    teams: { dev: "member" },
    level: "L3",
  },
  summaryViewer: {
    key: "summaryViewer",
    email: "marcus@qmatus.test",
    name: "Marcus Webb",
    title: "Finance & Admin",
    orgRole: "admin",
    teams: {},
  },
  reader: {
    key: "reader",
    email: "tara@qmatus.test",
    name: "Tara Quinn",
    title: "Advisor",
    orgRole: "member",
    teams: {},
  },
  dual: {
    key: "dual",
    email: "noor@qmatus.test",
    name: "Noor Haddad",
    title: "Product Engineer",
    orgRole: "member",
    teams: { founders: "member", dev: "member" },
  },
  suspended: {
    key: "suspended",
    email: "former@qmatus.test",
    name: "Jules Moreau",
    title: "Contractor",
    orgRole: "member",
    teams: { dev: "member" },
  },
  removed: {
    key: "removed",
    email: "kai@qmatus.test",
    name: "Kai Brennan",
    title: "Contractor",
    orgRole: "member",
    teams: { dev: "member" },
  },
  expired: {
    key: "expired",
    email: "elena@qmatus.test",
    name: "Elena Ruiz",
    title: "Consultant",
    orgRole: "member",
    teams: {},
  },
} satisfies Record<string, FixtureUser>;

export type UserKey = keyof typeof USERS;

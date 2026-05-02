import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
    } & DefaultSession["user"];
  }
  interface User {
    tenantId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    tenant_id?: string;
  }
}

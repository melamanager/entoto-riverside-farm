import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "farmer" | "supervisor" | "manager";
      avatar: string;
    };
  }
}

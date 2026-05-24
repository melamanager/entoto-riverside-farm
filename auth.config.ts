import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.farmerId = user.id;
        token.role = (user as { role: string }).role;
        token.avatar = (user as { avatar: string }).avatar;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as { id: string }).id = token.farmerId as string;
      (session.user as { role: string }).role = token.role as string;
      (session.user as { avatar: string }).avatar = token.avatar as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;

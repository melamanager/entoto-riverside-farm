import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        farmerId: { label: "Account", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.farmerId || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { farmerId: credentials.farmerId as string },
          include: { farmer: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.farmerId,
          name: user.farmer.name,
          email: user.email ?? undefined,
          role: user.farmer.role,
          avatar: user.farmer.avatar,
        };
      },
    }),
  ],
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
});

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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
});

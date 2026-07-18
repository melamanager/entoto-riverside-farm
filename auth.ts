import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { rateLimit } from "@/lib/rate-limit";

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

        // throttle brute-force: max 8 attempts per account per 5 minutes
        const gate = rateLimit(`login:${credentials.farmerId}`, 8, 5 * 60_000);
        if (!gate.ok) {
          throw new Error("Too many attempts. Please wait a few minutes and try again.");
        }

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

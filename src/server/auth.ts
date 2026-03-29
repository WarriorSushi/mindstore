import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { isGoogleAuthConfigured } from "@/server/identity";

const providers = isGoogleAuthConfigured()
  ? [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ]
  : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Upsert user
      const existing = await db.execute(
        sql`SELECT id FROM users WHERE email = ${user.email}`
      );

      let userId: string;
      if ((existing as any[]).length > 0) {
        userId = (existing as any[])[0].id;
      } else {
        const result = await db.execute(sql`
          INSERT INTO users (email, name, image)
          VALUES (${user.email}, ${user.name || null}, ${user.image || null})
          RETURNING id
        `);
        userId = (result as any[])[0].id;
      }

      // Upsert OAuth account link
      if (account) {
        await db.execute(sql`
          INSERT INTO accounts (user_id, type, provider, provider_account_id, access_token, refresh_token, expires_at)
          VALUES (${userId}::uuid, ${account.type}, ${account.provider}, ${account.providerAccountId}, ${account.access_token || null}, ${account.refresh_token || null}, ${account.expires_at || null})
          ON CONFLICT DO NOTHING
        `);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const result = await db.execute(
          sql`SELECT id FROM users WHERE email = ${user.email}`
        );
        if ((result as any[]).length > 0) {
          token.userId = (result as any[])[0].id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        (session as any).userId = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});

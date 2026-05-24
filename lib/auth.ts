import { NextAuthOptions, DefaultSession, DefaultUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { adminDb } from './firebase-admin';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      projectId: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    role: string;
    projectId: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    projectId: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          // 1. Authenticate with Firebase REST API
          const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              returnSecureToken: true
            }),
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!res.ok) {
             return null;
          }

          const authData = await res.json();

          // 2. Fetch custom user data (role, project) from Firestore
          const userDoc = await adminDb.collection('users').doc(authData.localId).get();
          const userData = userDoc.data();

          return {
            id: authData.localId,
            name: userData?.name || 'Unknown',
            email: credentials.email,
            role: userData?.role ?? 'USER',
            projectId: userData?.project_id ?? null,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.projectId = user.projectId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.projectId = token.projectId as string | null;
      }
      return session;
    },
  },

  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};

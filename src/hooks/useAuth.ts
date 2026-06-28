import { useState, useEffect } from 'react';
import { signInWithGoogle, onAuthChange } from '../lib/firebase';
import { syncParticipantByEmail } from '../services/issueService';
import type { User } from '../lib/firebase';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  sessionId: string; // Firestore-persisted session ID linked to Gmail
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser: User | null) => {
      if (firebaseUser && firebaseUser.email) {
        const name = firebaseUser.displayName || firebaseUser.email.split('@')[0];
        // Sync or create participant record keyed by Gmail — returns persistent sessionId
        const sessionId = await syncParticipantByEmail(firebaseUser.email, name);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: name,
          photoURL: firebaseUser.photoURL,
          sessionId,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (): Promise<AuthUser | null> => {
    const firebaseUser = await signInWithGoogle();
    if (!firebaseUser || !firebaseUser.email) return null;
    const name = firebaseUser.displayName || firebaseUser.email.split('@')[0];
    const sessionId = await syncParticipantByEmail(firebaseUser.email, name);
    const authUser: AuthUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: name,
      photoURL: firebaseUser.photoURL,
      sessionId,
    };
    setUser(authUser);
    return authUser;
  };

  return { user, loading, signIn };
}

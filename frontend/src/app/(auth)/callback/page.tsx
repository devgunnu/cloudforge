'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/store/useAuthStore';

interface JWTPayload {
  sub: string;
  username: string;
  avatar_url?: string;
  exp: number;
}

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      try {
        const decoded = jwtDecode<JWTPayload>(token);
        const user = {
          id: decoded.sub,
          username: decoded.username,
          avatar_url: decoded.avatar_url,
        };
        setAuth(token, user);
        router.push('/dashboard');
      } catch (error) {
        console.error('Failed to decode token:', error);
        router.push('/login?error=invalid_token');
      }
    } else {
      router.push('/login?error=no_token');
    }
  }, [searchParams, setAuth, router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Finalizing login...</p>
    </div>
  );
}

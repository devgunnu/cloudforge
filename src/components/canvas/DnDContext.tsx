'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type DnDContextValue = [string | null, (type: string | null) => void];

const DnDContext = createContext<DnDContextValue>([null, () => {}]);

export function DnDProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<string | null>(null);
  return (
    <DnDContext.Provider value={[type, setType]}>
      {children}
    </DnDContext.Provider>
  );
}

export function useDnD(): DnDContextValue {
  return useContext(DnDContext);
}

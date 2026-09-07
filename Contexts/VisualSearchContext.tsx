import React, {
  createContext,
  useContext,
  useState,
} from 'react';

export type VisualSearchResult = {
  rank: number;
  productId: string;
  score: number;
  matchedImageId: string;
};

type VisualSearchContextType = {
  results: VisualSearchResult[];
  setResults: (results: VisualSearchResult[]) => void;
  clearResults: () => void;
};

const VisualSearchContext =
  createContext<VisualSearchContextType | null>(null);

export function VisualSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [results, setResults] =
    useState<VisualSearchResult[]>([]);

  const clearResults = () => {
    setResults([]);
  };

  return (
    <VisualSearchContext.Provider
      value={{
        results,
        setResults,
        clearResults,
      }}
    >
      {children}
    </VisualSearchContext.Provider>
  );
}

export function useVisualSearch() {
  const context = useContext(VisualSearchContext);

  if (!context) {
    throw new Error(
      'useVisualSearch must be used inside VisualSearchProvider'
    );
  }

  return context;
}
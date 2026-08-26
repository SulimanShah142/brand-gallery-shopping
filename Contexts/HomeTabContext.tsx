// contexts/HomeTabContext.tsx

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
} from 'react';

import { FlatList } from 'react-native';

type HomeTabContextType = {
  registerHomeActions: (
    actions: {
      scrollToTop: () => void;
      refresh: () => Promise<void>;
    } | null
  ) => void;

  handleHomeTabPress: () => Promise<void>;
};

const HomeTabContext =
  createContext<HomeTabContextType | null>(null);

export function HomeTabProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const actionsRef = useRef<{
    scrollToTop: () => void;
    refresh: () => Promise<void>;
  } | null>(null);

  const registerHomeActions = useCallback(
    (
      actions: {
        scrollToTop: () => void;
        refresh: () => Promise<void>;
      } | null
    ) => {
      actionsRef.current = actions;
    },
    []
  );

  const handleHomeTabPress = useCallback(async () => {
    const actions = actionsRef.current;

    if (!actions) {
      return;
    }

    // Always return Home to the top.
    actions.scrollToTop();

    // Then refresh its catalog.
    await actions.refresh();
  }, []);

  return (
    <HomeTabContext.Provider
      value={{
        registerHomeActions,
        handleHomeTabPress,
      }}
    >
      {children}
    </HomeTabContext.Provider>
  );
}

export function useHomeTab() {
  const context = useContext(HomeTabContext);

  if (!context) {
    throw new Error(
      'useHomeTab must be used inside HomeTabProvider'
    );
  }

  return context;
}
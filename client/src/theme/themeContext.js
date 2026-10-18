import { createContext, useContext } from 'react';

export const ThemeContext = createContext({ theme: 'light', toggle: () => {}, setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import { useTheme } from './theme/themeContext.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './realtime/socket.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';
import { router } from './routes/index.jsx';

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      closeButton
      toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: '12px' } }}
    />
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <NotificationsProvider>
              <RouterProvider router={router} />
              <ThemedToaster />
            </NotificationsProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}

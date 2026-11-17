import { GameProvider } from './context/GameContext';
import MainLayout from './layouts/MainLayout';
import AppRoutes from './routes/AppRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <MainLayout>
          <AppRoutes />
        </MainLayout>
      </GameProvider>
    </ErrorBoundary>
  );
}

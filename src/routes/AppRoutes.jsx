import { useState } from 'react';
import GamePage from '../pages/Game';
import LoginPage from '../pages/Login';
import authService from '../services/authService';

export default function AppRoutes() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => authService.isAuthenticated());
  const [playAsGuest, setPlayAsGuest] = useState(false);

  // Show Login Page initially unless already logged in or clicked guest play
  if (!isLoggedIn && !playAsGuest) {
    return (
      <LoginPage
        onLoginSuccess={() => setIsLoggedIn(true)}
        onGuestPlay={() => setPlayAsGuest(true)}
      />
    );
  }

  return <GamePage />;
}

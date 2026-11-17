// ============================================================================
// Custom Hook for Plinko Game APIs (Standard Chapter 2 Architecture)
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import plinkoService from '../services/plinkoService';

export function usePlinkoApi() {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // 1. Fetch Game Config
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await plinkoService.getGameConfig();
      if (res?.data) setConfig(res.data);
    } catch (err) {
      console.warn('Failed to load game config:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // 2. Init Session Handshake
  const initSession = useCallback(async (token) => {
    setLoadingSession(true);
    try {
      const res = await plinkoService.initSession(token);
      if (res) setSession(res);
      return res;
    } catch (err) {
      console.warn('Session init failed:', err);
      return null;
    } finally {
      setLoadingSession(false);
    }
  }, []);

  // 3. Drop Bet API
  const dropBet = useCallback(async ({ bet, tier, currentCoins }) => {
    return await plinkoService.dropBallBet({ bet, tier, currentCoins });
  }, []);

  // 4. Settle Bet API
  const settleBet = useCallback(async (params) => {
    return await plinkoService.settleBet(params);
  }, []);

  // 5. My History API
  const fetchMyHistory = useCallback(async (page = 1, limit = 20) => {
    return await plinkoService.getMyBetHistory({ page, limit });
  }, []);

  // 6. Live Bets Feed API
  const fetchLiveBets = useCallback(async (limit = 15) => {
    return await plinkoService.getLiveBetsFeed({ limit });
  }, []);

  // 7. Game Action API
  const executeAction = useCallback(async (action, payload) => {
    return await plinkoService.executeGameAction({ action, payload });
  }, []);

  useEffect(() => {
    fetchConfig();
    initSession();
  }, [fetchConfig, initSession]);

  return {
    config,
    loadingConfig,
    session,
    loadingSession,
    fetchConfig,
    initSession,
    dropBet,
    settleBet,
    fetchMyHistory,
    fetchLiveBets,
    executeAction,
  };
}

export default usePlinkoApi;

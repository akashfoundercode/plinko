import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Plinko Arcade caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 grid place-items-center bg-[#0d091e] text-white p-4 font-display">
          <div className="max-w-md w-full rounded-3xl bg-[#1c1538] border-2 border-amber-500/50 p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center text-3xl mb-4">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-xs text-white/60 mb-6">
              Plinko arcade encountered a rendering hiccup. Click below to refresh.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-sm shadow-lg hover:brightness-110 active:scale-95 transition cursor-pointer"
            >
              🔄 RELOAD GAME
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

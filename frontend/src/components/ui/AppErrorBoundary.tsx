
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-cream p-6">
          <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-lg">
            <div className="mb-4 text-5xl">🌿</div>

            <h1 className="text-2xl font-bold text-forest">
              Something went wrong.
            </h1>

            <p className="mt-3 text-ink/60">
              We encountered an unexpected error.
              Please refresh the page to try again.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-xl bg-forest px-6 py-3 font-semibold text-white hover:bg-leaf"
            >
              Refresh page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

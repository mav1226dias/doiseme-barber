import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, errorMsg: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-100 text-red-900 min-h-screen">
          <h1 className="text-2xl font-bold mb-4">A aplicação encontrou um erro:</h1>
          <p className="font-mono bg-white p-4 rounded shadow">{this.state.errorMsg}</p>
          <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded" onClick={() => window.location.href = '/'}>Voltar ao Início</button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default ErrorBoundary;

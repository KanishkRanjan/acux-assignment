import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Escalate the fault to render the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error strictly intercepted by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const sessionId = localStorage.getItem('session_id') || "Unknown Session";
      
      return (
        <div style={{ 
          padding: '3rem', 
          textAlign: 'center', 
          fontFamily: 'monospace', 
          backgroundColor: '#1E1E2E', 
          color: '#F38BA8', 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', marginTop: 0 }}>⚠️ UI Rendering Fault</h1>
          <p style={{ fontSize: '1.2rem', color: '#CDD6F4', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: '1.5' }}>
            The dashboard intercepted a fatal React rendering exception. Instead of a blank screen, we gracefully intercepted the error boundary.
          </p>
          <div style={{ 
            backgroundColor: '#181825', 
            padding: '2rem', 
            borderRadius: '12px', 
            border: '1px solid #313244',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <p style={{ margin: '0 0 0.75rem 0', color: '#A6ADC8', fontSize: '1.1rem' }}>Please provide this session trace to IT Support:</p>
            <strong style={{ fontSize: '2rem', color: '#89B4FA', letterSpacing: '2px' }}>
              {sessionId}
            </strong>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

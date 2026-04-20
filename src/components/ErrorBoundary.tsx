import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  /**
   * When this key changes (e.g. route pathname), the boundary auto-resets so the
   * user is never stuck on a blank/error screen after navigating away.
   */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Algo deu errado nesta tela</h2>
              <p className="text-sm text-muted-foreground">
                A página encontrou um erro inesperado. Seus dados estão salvos.
              </p>
              {this.state.error?.message && (
                <p className="text-xs text-muted-foreground/80 mt-2 font-mono break-words">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={this.reset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar de novo
              </Button>
              <Button size="sm" className="gradient-primary border-0" onClick={() => { window.location.href = '/'; }}>
                <Home className="h-3.5 w-3.5 mr-1.5" /> Ir para o início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;

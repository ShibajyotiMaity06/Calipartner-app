import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { ErrorState } from '@/components/ErrorState';
import { createLogger } from '@/lib/logger';

const log = createLogger('error-boundary');

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Global error boundary: catches render errors and offers a reset. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error(error.message, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false });

  override render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center' }} testID="error-boundary">
          <ErrorState onRetry={this.reset} />
        </View>
      );
    }
    return this.props.children;
  }
}

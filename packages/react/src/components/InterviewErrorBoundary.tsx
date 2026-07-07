import { Component, type ErrorInfo, type ReactNode } from 'react';

interface InterviewErrorBoundaryProps {
  children: ReactNode;
  shellClassName: string;
  /**
   * Whenever this changes while an error is showing, the boundary resets
   * itself automatically — e.g. InterviewWidget derives it from
   * questions/rubric, so a host app editing those live (a question
   * builder) recovers on its own the moment the config becomes valid
   * again, instead of staying stuck until something manually resets it.
   */
  resetKey: string;
}

interface InterviewErrorBoundaryState {
  error: Error | undefined;
}

/**
 * A real AI provider's response shape is outside this SDK's control — a
 * malformed reply, an unexpected schema change, or any other unforeseen
 * error should surface as a recoverable message, never blank the whole
 * page with no feedback. React only catches render-time errors at a class
 * component boundary like this one; there is no hook equivalent.
 *
 * Developer misconfiguration (missing adapter, invalid rubric, etc.) is
 * checked in InterviewWidget before this boundary ever renders its child,
 * so those still throw loudly and immediately instead of landing here.
 */
export class InterviewErrorBoundary extends Component<
  InterviewErrorBoundaryProps,
  InterviewErrorBoundaryState
> {
  override state: InterviewErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: Error): InterviewErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('InterviewWidget crashed:', error, info.componentStack);
  }

  override componentDidUpdate(prevProps: InterviewErrorBoundaryProps): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  private reset = (): void => {
    this.setState({ error: undefined });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className={`${this.props.shellClassName} isdk-widget--center`}>
        <div className="isdk-widget__hero">
          <div className="isdk-lobby">
            <p className="isdk-kicker">Something went wrong</p>
            <h2 className="isdk-lobby__title">The interview hit an unexpected error</h2>
            <p className="isdk-lobby__meta">{error.message}</p>
            <div className="isdk-lobby__actions">
              <button className="isdk-btn isdk-btn--primary" type="button" onClick={this.reset}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

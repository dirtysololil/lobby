"use client";

import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { ErrorState } from "@/components/ui/error-state";

interface SettingsSectionBoundaryProps {
  children: ReactNode;
  description: string;
  resetKeys?: readonly unknown[];
  title: string;
}

interface SettingsSectionBoundaryState {
  hasError: boolean;
}

function areResetKeysEqual(
  previousKeys: readonly unknown[] | undefined,
  nextKeys: readonly unknown[] | undefined,
) {
  if (previousKeys === nextKeys) {
    return true;
  }

  if (!previousKeys || !nextKeys || previousKeys.length !== nextKeys.length) {
    return false;
  }

  return previousKeys.every((value, index) =>
    Object.is(value, nextKeys[index]),
  );
}

export class SettingsSectionBoundary extends Component<
  SettingsSectionBoundaryProps,
  SettingsSectionBoundaryState
> {
  override state: SettingsSectionBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("settings.section.error", {
      componentStack: info.componentStack,
      message: error.message,
      title: this.props.title,
    });
  }

  override componentDidUpdate(previousProps: SettingsSectionBoundaryProps) {
    if (
      this.state.hasError &&
      !areResetKeysEqual(previousProps.resetKeys, this.props.resetKeys)
    ) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={this.props.title}
          description={this.props.description}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

import { Component, type ReactNode } from "react"

import {
  noopAppErrorReporter,
  type AppErrorReporter,
} from "./app-error-reporter"
import { GlobalRecoveryScreen } from "./GlobalRecoveryScreen"

type Props = {
  children: ReactNode
  reporter?: AppErrorReporter
}

type State = { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    ;(this.props.reporter ?? noopAppErrorReporter).capture({
      category: "render",
      error,
    })
  }

  render() {
    if (this.state.failed) {
      return (
        <GlobalRecoveryScreen
          category="unexpected"
          action="reload"
          onRetry={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react"

export class AccountDetailErrorBoundary extends Component<{ children: ReactNode; resetKey: string; fallback: (error: Error) => ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Account detail rendering failed", error, info) }
  componentDidUpdate(previous: Readonly<{ resetKey: string }>) { if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null }) }
  render() { return this.state.error ? this.props.fallback(this.state.error) : this.props.children }
}

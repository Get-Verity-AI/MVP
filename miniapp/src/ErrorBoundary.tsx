// miniapp/src/ErrorBoundary.tsx
import { Component, type ReactNode } from "react";
export default class ErrorBoundary extends Component<{children:ReactNode},{err?:any}> {
  state = { err: undefined as any };
  static getDerivedStateFromError(err:any){ return { err }; }
  render(){
    if (this.state.err) return (
      <div style={{padding:16}}>
        <h2>App error</h2>
        <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.err?.stack||this.state.err)}</pre>
      </div>
    );
    return this.props.children;
  }
}

import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { ready, user } = useAuth();
  if (!ready) return <div className="container"><div className="card">Loading…</div></div>;
  return user ? children : <Navigate to="/signin" replace />;
}

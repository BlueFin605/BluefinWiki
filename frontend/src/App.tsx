import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CognitoUser } from 'amazon-cognito-identity-js';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PagesView } from './components/pages/PagesView';
import { PageTypesAdmin } from './components/admin/PageTypesAdmin';
import userPool from './config/cognitoConfig';
import { handleOAuthCallback, redirectToLogin } from './utils/cognitoAuth';

// Query client with NO caching - always fetch fresh data
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,      // Data is immediately stale
      gcTime: 0,         // Don't cache data at all
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    },
  },
});

// Placeholder Dashboard component
const Dashboard = () => (
  <div className="min-h-screen bg-gray-50 p-8">
    <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
    <p className="text-gray-600">Welcome to BlueFinWiki!</p>
    <Link
      to="/pages"
      className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
    >
      Go to Pages
    </Link>
  </div>
);

const DISABLE_AUTH = import.meta.env.DEV && import.meta.env.VITE_DISABLE_AUTH === 'true';

const AuthGate = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (DISABLE_AUTH || isLoading || isAuthenticated) {
      return;
    }

    redirectToLogin();
  }, [isAuthenticated, isLoading, location.pathname]);

  if (DISABLE_AUTH || isAuthenticated) {
    return children;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Redirecting to sign in...</p>
    </div>
  );
};

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (!code || !state) {
          throw new Error('Missing authorization code or state in callback URL.');
        }

        const authResult = await handleOAuthCallback(code, state);
        const payload = authResult.session.getIdToken().payload;
        const username = payload['cognito:username'] || payload.email || payload.sub;

        const cognitoUser = new CognitoUser({
          Username: username,
          Pool: userPool,
        });

        cognitoUser.setSignInUserSession(authResult.session);
        localStorage.setItem('idToken', authResult.idToken);
        localStorage.setItem('accessToken', authResult.accessToken);

        navigate('/pages', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication callback failed.';
        setError(message);
      }
    };

    completeSignIn();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign in failed</h1>
          <p className="mt-3 text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => redirectToLogin()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Completing sign in...</p>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/callback" element={<OAuthCallbackPage />} />

            <Route path="/dashboard" element={<AuthGate><Dashboard /></AuthGate>} />
            <Route path="/pages" element={<AuthGate><PagesView /></AuthGate>} />
            <Route path="/pages/*" element={<AuthGate><PagesView /></AuthGate>} />
            <Route path="/admin/page-types" element={<AuthGate><PageTypesAdmin /></AuthGate>} />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/pages" replace />} />

            {/* 404 - Not Found */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <h1 className="text-6xl font-bold text-gray-900">404</h1>
                    <p className="text-xl text-gray-600 mt-4">Page not found</p>
                    <a
                      href="/"
                      className="mt-8 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Go Home
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

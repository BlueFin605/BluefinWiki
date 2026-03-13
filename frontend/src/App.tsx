import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { PagesView } from './components/pages/PagesView';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pages" element={<PagesView />} />
            <Route path="/pages/*" element={<PagesView />} />

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

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Anuncios } from "./pages/Anuncios";
import { Leads } from "./pages/Leads";
import { Conversaciones } from "./pages/Conversaciones";
import { Cualificados } from "./pages/Cualificados";
import { Configuracion } from "./pages/Configuracion";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/anuncios"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Anuncios />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Leads />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conversaciones"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Conversaciones />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cualificados"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Cualificados />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracion"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Configuracion />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

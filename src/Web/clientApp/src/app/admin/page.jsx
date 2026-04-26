import ProtectedRoute from "../../components/ProtectedRoute";
import AdminPage from "../../screens/AdminPage";

export default function AdminRoute() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminPage />
    </ProtectedRoute>
  );
}

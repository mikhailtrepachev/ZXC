import ProtectedRoute from "../../components/ProtectedRoute";
import PaymentsPage from "../../screens/PaymentsPage";

export default function PaymentsRoute() {
  return (
    <ProtectedRoute>
      <PaymentsPage />
    </ProtectedRoute>
  );
}

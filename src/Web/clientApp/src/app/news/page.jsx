import ProtectedRoute from "../../components/ProtectedRoute";
import FinancialNewsPage from "../../screens/FinancialNewsPage";

export default function NewsRoute() {
  return (
    <ProtectedRoute>
      <FinancialNewsPage />
    </ProtectedRoute>
  );
}

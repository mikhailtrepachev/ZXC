import ProtectedRoute from "../../components/ProtectedRoute";
import LoansPage from "../../screens/LoansPage";

export default function LoansRoute() {
  return (
    <ProtectedRoute>
      <LoansPage />
    </ProtectedRoute>
  );
}

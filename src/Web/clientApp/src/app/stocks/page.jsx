import ProtectedRoute from "../../components/ProtectedRoute";
import StocksPage from "../../screens/StocksPage";

export default function StocksRoute() {
  return (
    <ProtectedRoute>
      <StocksPage />
    </ProtectedRoute>
  );
}

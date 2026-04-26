import ProtectedRoute from "../../components/ProtectedRoute";
import CardsPage from "../../screens/CardsPage";

export default function CardsRoute() {
  return (
    <ProtectedRoute>
      <CardsPage />
    </ProtectedRoute>
  );
}

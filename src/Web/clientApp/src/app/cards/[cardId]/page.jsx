import ProtectedRoute from "../../../components/ProtectedRoute";
import CardDetailsPage from "../../../screens/CardDetailsPage";

export default function CardDetailsRoute() {
  return (
    <ProtectedRoute>
      <CardDetailsPage />
    </ProtectedRoute>
  );
}

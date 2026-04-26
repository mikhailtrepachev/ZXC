import ProtectedRoute from "../../../components/ProtectedRoute";
import AccountDetailsPage from "../../../screens/AccountDetailsPage";

export default function AccountDetailsRoute() {
  return (
    <ProtectedRoute>
      <AccountDetailsPage />
    </ProtectedRoute>
  );
}

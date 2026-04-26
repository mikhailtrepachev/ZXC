import ProtectedRoute from "../../components/ProtectedRoute";
import AccountsPage from "../../screens/AccountsPage";

export default function AccountsRoute() {
  return (
    <ProtectedRoute>
      <AccountsPage />
    </ProtectedRoute>
  );
}

import ProtectedRoute from "../../../../components/ProtectedRoute";
import AccountConversionPage from "../../../../screens/AccountConversionPage";

export default function AccountConversionRoute() {
  return (
    <ProtectedRoute>
      <AccountConversionPage />
    </ProtectedRoute>
  );
}

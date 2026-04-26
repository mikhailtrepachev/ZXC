import ProtectedRoute from "../../components/ProtectedRoute";
import UserSettingsPage from "../../screens/UserSettingsPage";

export default function UserSettingsRoute() {
  return (
    <ProtectedRoute>
      <UserSettingsPage />
    </ProtectedRoute>
  );
}

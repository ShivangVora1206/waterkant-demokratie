import { Navigate, Route, Routes } from "react-router-dom";
import ViewerPage from "./views/Viewer.jsx";
import SummaryPage from "./views/Summary.jsx";
import AdminPage from "./views/admin/AdminPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ViewerPage />} />
      <Route path="/summary/:sessionUid" element={<SummaryPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

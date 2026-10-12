import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProblemPage } from "./pages/ProblemPage";
import "./styles.css";

// The workspace pulls in the diagram layout engine; load it and the other heavy pages on demand.
const WorkspacePage = lazy(() => import("./pages/workspace/WorkspacePage").then((m) => ({ default: m.WorkspacePage })));
const FeedbackPage = lazy(() => import("./pages/feedback/FeedbackPage").then((m) => ({ default: m.FeedbackPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="problems/:slug" element={<ProblemPage />} />
          <Route
            path="attempts/:attemptId"
            element={
              <Suspense>
                <WorkspacePage />
              </Suspense>
            }
          />
          <Route
            path="submissions/:submissionId"
            element={
              <Suspense>
                <FeedbackPage />
              </Suspense>
            }
          />
          <Route
            path="history"
            element={
              <Suspense>
                <HistoryPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

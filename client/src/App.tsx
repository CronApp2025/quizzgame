import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import EditQuiz from "@/pages/admin/edit-quiz";
import HostQuiz from "@/pages/admin/host-quiz";
import UserJoin from "@/pages/user/join";
import UserPlay from "@/pages/user/play";
import DebugPage from "@/pages/debug";

function Router() {
  return (
    <Switch>
      {/* Admin Routes */}
      <Route path="/" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/quiz/new" component={EditQuiz} />
      <Route path="/admin/quiz/:id/edit" component={EditQuiz} />
      <Route path="/admin/quiz/:id/host" component={HostQuiz} />
      
      {/* User Routes */}
      <Route path="/join" component={UserJoin} />
      <Route path="/play" component={UserPlay} />
      
      {/* Debug Route */}
      <Route path="/debug" component={DebugPage} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Router />
    </TooltipProvider>
  );
}

export default App;

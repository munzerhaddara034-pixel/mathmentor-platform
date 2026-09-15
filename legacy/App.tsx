import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import InternationalSchools from "@/pages/InternationalSchools";
import Grade9MockExam from "@/pages/Grade9MockExam";
import Grade12MiniMockExam from "@/pages/Grade12MiniMockExam";
import Grade12LongMockExam from "@/pages/Grade12LongMockExam";
import QuestionBank from "@/pages/QuestionBank";
import SchoolOutreach from "@/pages/SchoolOutreach";
import StudentProgress from "@/pages/StudentProgress";
import LessonReview from "@/pages/LessonReview";
import ExamModels from "@/pages/ExamModels";
import ExamModelRunner from "@/pages/ExamModelRunner";
import SkillPractice from "@/pages/SkillPractice";
import SolutionApprovals from "@/pages/SolutionApprovals";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/academy" component={Home} />
      <Route path="/international-schools" component={InternationalSchools} />
      <Route path="/mock-exam/grade-9" component={Grade9MockExam} />
      <Route path="/mock-exam/grade-12-mini" component={Grade12MiniMockExam} />
      <Route path="/mock-exam/grade-12-diagnostic" component={Grade12LongMockExam} />
      <Route path="/question-bank" component={QuestionBank} />
      <Route path="/exam-models" component={ExamModels} />
      <Route path="/exam-models/:modelId" component={ExamModelRunner} />
      <Route path="/school-outreach" component={SchoolOutreach} />
      <Route path="/student-progress" component={StudentProgress} />
      <Route path="/lesson-review/:slug" component={LessonReview} />
      <Route path="/skill-practice/:slug" component={SkillPractice} />
      <Route path="/solution-approvals" component={SolutionApprovals} />
      <Route path="/management" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import NewBook from "@/pages/NewBook";
import Analysis from "@/pages/Analysis";
import Resources from "@/pages/Resources";
import Blueprint from "@/pages/Blueprint";
import Write from "@/pages/Write";
import Quality from "@/pages/Quality";
import Export from "@/pages/Export";
import Layout from "@/components/Layout";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/books/new" component={NewBook} />
        <Route path="/books/:id/analysis" component={Analysis} />
        <Route path="/books/:id/resources" component={Resources} />
        <Route path="/books/:id/blueprint" component={Blueprint} />
        <Route path="/books/:id/write" component={Write} />
        <Route path="/books/:id/quality" component={Quality} />
        <Route path="/books/:id/export" component={Export} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

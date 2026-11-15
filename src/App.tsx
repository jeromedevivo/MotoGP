import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Calendar from "./pages/Calendar";
import Standings from "./pages/Standings";
import Riders from "./pages/Riders";
import RiderDetail from "./pages/RiderDetail";
import RiderStats from "./pages/RiderStats";
import EventDetail from "./pages/EventDetail";
import Predictions from "./pages/Predictions";
import LiveTiming from "./pages/LiveTiming";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/riders" element={<Riders />} />
          <Route path="/riders/:id" element={<RiderDetail />} />
          <Route path="/riders/:id/stats" element={<RiderStats />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/live-timing" element={<LiveTiming />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 text-center">
      <p className="text-4xl font-bold text-foreground mb-2">404</p>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <Button onClick={() => setLocation("/")} variant="outline">
        <Home className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

const ALLOWED_DOMAIN = "colcacchio.co.za";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (!authLoading && session) navigate(from, { replace: true });
  }, [authLoading, session, navigate, from]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    const domain = normalized.split("@")[1];
    if (domain !== ALLOWED_DOMAIN) {
      toast.error(`Only @${ALLOWED_DOMAIN} email addresses are allowed`);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Check your email for the sign-in link");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <h1 className="sr-only">Col'Cacchio Menu Dashboard — Sign in</h1>
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-primary text-primary-foreground overflow-hidden">
            <img src="/favicon.png" alt="Col'Cacchio" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <CardTitle>Col'Cacchio Menu Dashboard</CardTitle>
            <CardDescription>
              {sent
                ? "We've sent a sign-in link to your email"
                : `Sign in with your @${ALLOWED_DOMAIN} email`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MailCheck className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Click the link in the email sent to <strong>{email}</strong> to sign in.
                The link expires in 1 hour.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={`you@${ALLOWED_DOMAIN}`}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send sign-in link
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No password needed. Only @{ALLOWED_DOMAIN} addresses can sign in.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

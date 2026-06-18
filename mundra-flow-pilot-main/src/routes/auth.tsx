import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { signIn, signUp } from "@/lib/api/auth.functions";
import { setAccessToken } from "@/integrations/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Building2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Mundra Brothers Non-Trade Portal" },
      { name: "description", content: "Secure access to the Mundra Brothers non-trade dispatch and accounts control platform." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result =
        mode === "signin"
          ? await signIn({ data: { email, password } })
          : await signUp({ data: { email, password, fullName } });

      setAccessToken(result.accessToken);
      router.invalidate();
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-sidebar-primary grid place-items-center text-sidebar-primary-foreground font-bold">
            M
          </div>
          <div>
            <div className="font-semibold tracking-tight">Mundra Brothers</div>
            <div className="text-xs text-sidebar-foreground/70">Non-Trade Control Platform</div>
          </div>
        </div>

        <div className="space-y-6 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Transparent, auditable dispatch decisions for every non-trade order.
          </h1>
          <p className="text-sm text-sidebar-foreground/75">
            One control system for purchase orders, credit exposure, payment
            verification, refund letters, balance confirmations and approvals —
            with full audit trail.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-sidebar-primary" />
              Role-based access with maker-checker workflows
            </li>
            <li className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-sidebar-primary" />
              Strict tenant isolation across client organisations
            </li>
          </ul>
        </div>

        <div className="text-xs text-sidebar-foreground/60">
          © {new Date().getFullYear()} Mundra Brothers. Authorised personnel only.
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md border-border/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in to continue</CardTitle>
            <CardDescription>
              Use your work email. New users are provisioned by your administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {notice && (
                <Alert className="mt-4">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <TabsContent value="signup" className="space-y-4 m-0">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={mode === "signup"}
                      autoComplete="name"
                    />
                  </div>
                </TabsContent>

                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />
                  {mode === "signup" && (
                    <p className="text-xs text-muted-foreground">
                      Minimum 8 characters. Avoid commonly-leaked passwords.
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By continuing you agree to the platform usage policy and audit logging.
                </p>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

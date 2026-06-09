import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { featuresData, howItWorksData, statsData, testimonialsData } from "@/data/landing";
import HeroSection from "@/components/hero";
import Link from "next/link";
import { Check, ArrowRight, Star, Shield, Zap, BarChart3 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="mt-[65px]">
      <HeroSection />

      {/* ── Stats bar ── */}
      <section className="py-14 bg-white border-y border-gray-100">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {statsData.map((s, i) => (
              <div key={i} className="group">
                <div className="text-4xl md:text-5xl font-extrabold text-blue-600 mb-1 group-hover:scale-105 transition-transform">
                  {s.value}
                </div>
                <div className="text-gray-500 text-sm font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
              Features
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
              Everything you need to<br className="hidden md:block" /> master your money
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">
              Powerful tools, beautifully designed to help you track, budget, and grow.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuresData.map((f, i) => {
              const bgColors = [
                "bg-blue-50 border-blue-100",
                "bg-emerald-50 border-emerald-100",
                "bg-violet-50 border-violet-100",
                "bg-amber-50 border-amber-100",
                "bg-rose-50 border-rose-100",
                "bg-cyan-50 border-cyan-100",
              ];
              return (
                <Card key={i} className={`card-lift border rounded-2xl overflow-hidden ${bgColors[i % bgColors.length]}`}>
                  <CardContent className="p-7">
                    <div className="mb-4">{f.icon}</div>
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{f.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
              How It Works
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900">
              Up and running in minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {howItWorksData.map((step, i) => (
              <div key={i} className="relative text-center">
                {i < howItWorksData.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+3rem)] w-[calc(100%-6rem)] h-px bg-gradient-to-r from-blue-200 to-emerald-200" />
                )}
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl font-black text-white shadow-lg ${
                  i === 0 ? "bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-200"
                  : i === 1 ? "bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-200"
                  : "bg-gradient-to-br from-violet-500 to-purple-700 shadow-violet-200"
                }`}>
                  {i + 1}
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">
                  {step.title.replace(/^\d+\.\s/, "")}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us — colourful dark ── */}
      <section className="py-24 bg-gray-950 text-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <span className="inline-block bg-white/10 text-white/70 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
              Why FinTrack
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">Built for real people</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              We obsess over the details so you can focus on what matters — your financial future.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Zap size={24} />, title: "Lightning Fast", desc: "Instant transaction entry, real-time balance updates, snappy charts.", color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/20 text-yellow-400" },
              { icon: <Shield size={24} />, title: "Bank-Grade Security", desc: "AES-256 encryption, HTTP-only cookies, zero third-party auth risks.", color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/20 text-emerald-400" },
              { icon: <BarChart3 size={24} />, title: "AI-Powered Insights", desc: "Gemini AI scans receipts, categorises spending, and generates monthly reports.", color: "from-blue-500/20 to-indigo-500/10 border-blue-500/20 text-blue-400" },
            ].map((item, i) => (
              <div key={i} className={`bg-gradient-to-br ${item.color} border rounded-2xl p-7`}>
                <div className={`mb-4 ${item.color.split(" ").pop()}`}>{item.icon}</div>
                <h3 className="font-bold text-lg text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-gradient-to-b from-indigo-50 to-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
              Testimonials
            </span>
            <h2 className="text-4xl font-extrabold text-gray-900">Loved by thousands</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonialsData.map((t, i) => (
              <Card key={i} className="card-lift bg-white border-gray-100 rounded-2xl shadow-sm">
                <CardContent className="p-7">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <Image src={t.image} alt={t.name} width={40} height={40} className="rounded-full ring-2 ring-gray-100" />
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-400">{t.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <span className="inline-block bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
              Pricing
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
              Simple, honest pricing
            </h2>
            <p className="text-gray-500">Start free. No credit card needed.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            {[
              { name: "Free", price: "$0", desc: "For personal tracking", features: ["5 accounts", "Basic analytics", "Budgeting", "AI receipt scanning"], cta: "Get Started", href: "/sign-up", featured: false },
              { name: "Pro", price: "$9.99", period: "/mo", desc: "For power users", features: ["Unlimited accounts", "Advanced reports", "Custom budgets", "Priority support"], cta: "Start Free Trial", href: "/sign-up", featured: true },
              { name: "Business", price: "$29.99", period: "/mo", desc: "For teams", features: ["Team collaboration", "Auto reporting", "API access", "Dedicated support"], cta: "Contact Us", href: "/sign-up", featured: false },
            ].map((plan, i) => (
              <Card key={i} className={`rounded-2xl overflow-hidden transition-all duration-200 ${
                plan.featured
                  ? "border-2 border-blue-500 shadow-2xl shadow-blue-100 scale-105"
                  : "border-gray-100 shadow-sm hover:shadow-md"
              }`}>
                {plan.featured && (
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold text-center py-2 tracking-widest">
                    MOST POPULAR
                  </div>
                )}
                <CardContent className="p-7">
                  <h3 className="font-bold text-xl text-gray-900 mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-400 mb-1.5 text-sm">{plan.period}</span>}
                  </div>
                  <p className="text-gray-400 text-sm mb-6">{plan.desc}</p>
                  <ul className="space-y-3 mb-7">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Check size={11} className="text-emerald-600" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}>
                    <Button
                      className={`w-full ${plan.featured ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200" : ""}`}
                      variant={plan.featured ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-14">
            <span className="inline-block bg-cyan-100 text-cyan-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
              FAQ
            </span>
            <h2 className="text-4xl font-extrabold text-gray-900">Common questions</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "How secure is my data?", a: "We use AES-256 encryption at rest and TLS in transit. Authentication is handled with JWT tokens stored in HTTP-only cookies — no third-party auth providers ever touch your credentials." },
              { q: "Can I use FinTrack for free?", a: "Absolutely. Our free plan covers up to 5 accounts, unlimited transactions, AI receipt scanning, and budgeting. No credit card required." },
              { q: "How does the AI receipt scanner work?", a: "Upload a photo of any receipt and Google Gemini AI extracts the merchant, amount, date, and category automatically — saving you time on manual entry." },
              { q: "Does it support multiple currencies?", a: "Yes! You can record transactions in any currency. Multi-currency reporting with live conversion rates is on our roadmap." },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:border-blue-100">
                <h3 className="font-bold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-violet-500 rounded-full blur-3xl" />
        </div>
        <div className="relative container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5 leading-tight">
            Ready to take control<br />of your finances?
          </h2>
          <p className="text-blue-200 text-lg mb-10 leading-relaxed">
            Join 50,000+ people tracking smarter. Free forever, no credit card needed.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-10 gap-2 shadow-2xl">
                Start for Free <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

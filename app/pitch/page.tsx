"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Leaf, Sprout, Cpu, Brain, Droplets, Bug, Camera, Wind,
  ArrowRight, ArrowDown, Check, X, ShieldCheck, Zap, TrendingUp,
  Bot, Gauge, CloudSun, FlaskConical, Recycle, Globe, Quote,
  CircleDollarSign, Clock, AlertTriangle, Sparkles, MapPin,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Scroll-reveal helper — fades + lifts children into view on scroll
   ────────────────────────────────────────────────────────────────────────── */
function Reveal({
  children, delay = 0, className = "",
}: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* Count-up number animation for stats */
function CountUp({ to, suffix = "", prefix = "", decimals = 0 }: { to: number; suffix?: string; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(to * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{val.toFixed(decimals)}{suffix}</span>;
}

const SECTION = "w-full max-w-6xl mx-auto px-6 md:px-10";

export default function PitchPage() {
  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      {/* ── Sticky nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className={`${SECTION} flex items-center justify-between h-16`}>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary grid place-items-center shadow-lg shadow-primary/25">
              <Leaf className="size-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm tracking-tight">ENTOTO Riverside</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Smart Organic Farm</div>
            </div>
          </div>
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
          >
            Open Live Dashboard
            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* ambient gradient blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 size-[460px] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute top-20 right-0 size-[380px] rounded-full bg-emerald-400/15 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 size-[300px] rounded-full bg-lime-400/10 blur-[110px]" />
        </div>

        <div className={`${SECTION} relative pt-24 pb-28 text-center`}>
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-8">
              <Sparkles className="size-3.5" />
              Ethiopia&rsquo;s first AI-managed organic strawberry farm
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6">
              The whole farm,
              <br />
              <span className="bg-gradient-to-r from-primary via-emerald-500 to-lime-500 bg-clip-text text-transparent">
                grown by data &amp; nature.
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed mb-10">
              Live IoT sensors, AI disease detection, and a 100% organic treatment system —
              one platform that runs irrigation, spots sickness before you can see it, and
              feeds your plants with nothing but lemon, compost, coffee and wood ash.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/25 hover:shadow-primary/45 transition-all hover:-translate-y-0.5"
              >
                Explore the Live Demo
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/iot"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-sm font-semibold hover:bg-accent transition-colors"
              >
                <Cpu className="size-4 text-primary" />
                See the IoT Stack
              </Link>
            </div>
          </Reveal>

          {/* hero stat strip */}
          <Reveal delay={340}>
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-border bg-border max-w-4xl mx-auto">
              {[
                { v: <CountUp to={4.2} decimals={1} suffix=" ha" />, l: "Cultivated at 2,800 m" },
                { v: <CountUp to={21} />, l: "Smart-monitored beds" },
                { v: <CountUp to={100} suffix="%" />, l: "Organic inputs" },
                { v: <CountUp to={3} />, l: "Autonomous AI agents" },
              ].map((s, i) => (
                <div key={i} className="bg-card px-4 py-6">
                  <div className="text-2xl md:text-3xl font-black text-primary">{s.v}</div>
                  <div className="text-[11px] md:text-xs text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={460}>
            <div className="mt-16 flex items-center justify-center gap-2 text-xs text-muted-foreground animate-bounce">
              <ArrowDown className="size-4" />
              Scroll to explore
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-card/40 border-y border-border">
        <div className={SECTION}>
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="text-xs font-bold uppercase tracking-widest text-destructive mb-3">The old way</div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                Farming on guesswork is expensive
              </h2>
              <p className="text-muted-foreground">
                Most highland farms lose yield and money to problems they can&rsquo;t see until it&rsquo;s too late.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: AlertTriangle, stat: "30%", t: "Crop lost to disease", d: "Powdery mildew & botrytis spread for days before a human notices." },
              { icon: Droplets, stat: "40%", t: "Water wasted", d: "Fixed timers irrigate beds that are already soaked — or starve dry ones." },
              { icon: CircleDollarSign, stat: "₿igh", t: "Chemical bills", d: "Imported synthetic fungicides & NPK cost hard currency every month." },
              { icon: Clock, stat: "Days", t: "Reaction lag", d: "Paper logs mean managers learn about a crisis at the weekly meeting." },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="h-full rounded-2xl border border-border bg-background p-6 hover:border-destructive/40 transition-colors">
                  <div className="size-11 rounded-xl bg-destructive/10 grid place-items-center mb-4">
                    <p.icon className="size-5 text-destructive" />
                  </div>
                  <div className="text-2xl font-black text-destructive mb-1">{p.stat}</div>
                  <div className="font-semibold text-sm mb-2">{p.t}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution / Modules ─────────────────────────────────────────── */}
      <section className="py-24">
        <div className={SECTION}>
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">One platform</div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                Everything the farm needs, connected
              </h2>
              <p className="text-muted-foreground">
                From the soil probe to the manager&rsquo;s phone — sensing, deciding, and acting in one loop.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Cpu, t: "Live IoT Monitoring", d: "Soil moisture, EC, pH & temperature per bed, valve flow, tank levels and a high-altitude weather station — all streaming in real time.", tag: "Core" },
              { icon: Brain, t: "AI Disease Detection", d: "Cameras scan beds and flag mildew, botrytis, leaf spot and pests with confidence scores before symptoms are visible.", tag: "Most used" },
              { icon: Leaf, t: "Organic Treatment Engine", d: "Every alert comes with a household-natural recipe — lemon juice, garlic, wood ash, coffee — sourced locally in Addis.", tag: "Signature" },
              { icon: Droplets, t: "Smart Fertigation", d: "Compost tea, banana-peel tea and worm-casting drenches scheduled and logged per valve, dosed to soil readings." },
              { icon: Bot, t: "Autonomous Agents", d: "Watering, Disease Guard and Harvest Spotter agents think, act, and report — opening valves and raising tasks on their own." },
              { icon: TrendingUp, t: "Harvest Forecasting", d: "14-day yield prediction per bed so the harvest team and export cartons are ready before the berries are." },
            ].map((m, i) => (
              <Reveal key={i} delay={i * 70}>
                <div className="group relative h-full rounded-2xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all hover:-translate-y-1">
                  {m.tag && (
                    <span className="absolute top-5 right-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 uppercase tracking-wide">
                      {m.tag}
                    </span>
                  )}
                  <div className="size-12 rounded-xl bg-primary/10 grid place-items-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all">
                    <m.icon className="size-6 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <div className="font-bold mb-2">{m.t}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Organic Difference ─────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary/8 blur-[140px]" />
        </div>
        <div className={`${SECTION} relative`}>
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-3">
                <Recycle className="size-3.5" /> Zero synthetic chemicals
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                We swapped the lab for the kitchen
              </h2>
              <p className="text-muted-foreground">
                Every treatment in the system is made fresh from ingredients you&rsquo;d find in any Ethiopian market.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              { from: "Sulfur dust / fungicide", to: "Fresh lemon juice spray", use: "Powdery mildew" },
              { from: "Bordeaux copper mixture", to: "Wood ash tea (ye-enqubet)", use: "Leaf spot" },
              { from: "Trichoderma inoculant", to: "Double-strength coffee drench", use: "Root rot" },
              { from: "Synthetic NPK 20-20-20", to: "Compost & banana-peel tea", use: "Feeding" },
              { from: "Chemical pesticide", to: "Garlic + lemon blend", use: "Gray mold & pests" },
              { from: "Iron chelate (EDTA)", to: "Spent coffee grounds", use: "Iron / nitrogen" },
            ].map((r, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground line-through decoration-destructive/60">
                      <X className="size-3.5 text-destructive shrink-0" />
                      <span className="truncate">{r.from}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold mt-1.5">
                      <Check className="size-4 text-primary shrink-0" />
                      <span className="truncate">{r.to}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1">
                    {r.use}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── IoT Stack ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-card/40 border-y border-border">
        <div className={SECTION}>
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">The hardware</div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                Sensors in the soil, eyes on every bed
              </h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { icon: Gauge, t: "Soil Probes", d: "Moisture · EC · pH · temp, per bed, every 15 min" },
              { icon: Droplets, t: "Smart Valves", d: "3 zones, 1,400–1,840 L/h, auto + manual" },
              { icon: Camera, t: "AI Cameras", d: "6 units, CNN disease & ripeness scoring" },
              { icon: CloudSun, t: "Weather Station", d: "Humidity, dew-point, solar, UV at altitude" },
              { icon: Wind, t: "LoRa + 4G Mesh", d: "868 MHz nodes → MQTT gateway → cloud" },
            ].map((h, i) => (
              <Reveal key={i} delay={i * 70}>
                <div className="h-full rounded-2xl border border-border bg-background p-5 text-center hover:border-primary/50 transition-colors">
                  <div className="size-12 mx-auto rounded-2xl bg-primary/10 grid place-items-center mb-3">
                    <h.icon className="size-6 text-primary" />
                  </div>
                  <div className="font-bold text-sm mb-1.5">{h.t}</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{h.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Results / Metrics ──────────────────────────────────────────── */}
      <section className="py-24">
        <div className={SECTION}>
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">The payoff</div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                Data-driven results
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { v: <CountUp to={30} prefix="−" suffix="%" />, l: "Crop loss to disease", c: "text-primary" },
              { v: <CountUp to={40} prefix="−" suffix="%" />, l: "Water use per cycle", c: "text-primary" },
              { v: <CountUp to={100} prefix="−" suffix="%" />, l: "Synthetic chemical spend", c: "text-primary" },
              { v: <CountUp to={14} suffix=" day" />, l: "Yield forecast horizon", c: "text-emerald-500" },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-7 text-center">
                  <div className={`text-4xl md:text-5xl font-black ${s.c} mb-2`}>{s.v}</div>
                  <div className="text-xs text-muted-foreground">{s.l}</div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Testimonial */}
          <Reveal delay={200}>
            <div className="mt-12 max-w-3xl mx-auto rounded-3xl border border-border bg-card p-8 md:p-10 relative">
              <Quote className="size-8 text-primary/30 mb-4" />
              <p className="text-lg md:text-xl font-medium leading-relaxed mb-6">
                &ldquo;We used to find disease when it was already a crisis. Now the system
                tells a farmer to spray lemon juice at dusk before I&rsquo;ve even finished my
                coffee — and the spray <em>is</em> coffee.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full bg-primary grid place-items-center font-bold text-primary-foreground">NH</div>
                <div>
                  <div className="font-semibold text-sm">Nuredin Hassen</div>
                  <div className="text-xs text-muted-foreground">Farm Manager · Entoto Agro PLC</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Global Proof ───────────────────────────────────────────────── */}
      <section className="py-24 bg-card/40 border-y border-border">
        <div className={SECTION}>
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-3">
                <Globe className="size-3.5" /> Proven worldwide
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                The same playbook the leaders use
              </h2>
              <p className="text-muted-foreground">
                Precision-agriculture stacks like this run the world&rsquo;s most advanced farms.
                Entoto Riverside brings that model home — and makes it organic.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { flag: "🇮🇱", c: "Israel", d: "Netafim drip + CropX soil sensors — the original precision-irrigation model." },
              { flag: "🇳🇱", c: "Netherlands", d: "Priva & Ridder greenhouse automation, 24/7 sensor telemetry." },
              { flag: "🇰🇪", c: "Kenya", d: "Oserian & Vegpro — LoRa soil networks and camera scouting at Lake Naivasha." },
              { flag: "🇪🇹", c: "Ethiopia", d: "Sher Ethiopia & Ziway flower farms already run Netafim + Priva at scale." },
              { flag: "🇲🇦", c: "Morocco", d: "Souss-Massa strawberry belt — sensor-driven drip across thousands of hectares." },
              { flag: "🇪🇸", c: "Spain", d: "Huelva berry region — IoT soil + weather required for export certification." },
            ].map((g, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="h-full rounded-2xl border border-border bg-background p-6 hover:border-primary/40 transition-colors">
                  <div className="text-3xl mb-3">{g.flag}</div>
                  <div className="font-bold mb-2 flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary" /> {g.c}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{g.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / Why it works ───────────────────────────────────────── */}
      <section className="py-24">
        <div className={SECTION}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Built right</div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-6">
                  Reliable enough to bet a harvest on
                </h2>
                <div className="space-y-4">
                  {[
                    { icon: ShieldCheck, t: "Works offline-first", d: "LoRa nodes keep logging through network drops; the gateway syncs when 4G returns." },
                    { icon: Zap, t: "Acts in seconds", d: "Sensor → decision → valve or alert in real time, not at the weekly meeting." },
                    { icon: FlaskConical, t: "Agronomy-grade recipes", d: "Every organic treatment has exact ratios, timing and local sourcing notes." },
                    { icon: Globe, t: "Bilingual & local", d: "English + አማርኛ, prices in ETB, inputs from Addis markets." },
                  ].map((f, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="size-10 shrink-0 rounded-xl bg-primary/10 grid place-items-center">
                        <f.icon className="size-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm mb-0.5">{f.t}</div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{f.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { v: "868 MHz", l: "LoRaWAN band (EU/ET)" },
                    { v: "MQTT", l: "Telemetry protocol" },
                    { v: "15 min", l: "Sensor sample rate" },
                    { v: "0.70+", l: "AI alert threshold" },
                    { v: "Telegram", l: "+ SMS alerting" },
                    { v: "2,800 m", l: "Operating altitude" },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl bg-background/60 border border-border p-4">
                      <div className="text-lg font-black text-primary">{s.v}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="py-28 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[700px] rounded-full bg-primary/15 blur-[150px]" />
        </div>
        <div className={`${SECTION} relative text-center`}>
          <Reveal>
            <div className="size-16 mx-auto rounded-2xl bg-primary grid place-items-center shadow-2xl shadow-primary/30 mb-8">
              <Sprout className="size-8 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-5">
              See it running, live.
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground mb-10">
              No login wall, no setup. Open the dashboard and watch the farm think —
              valves, sensors, AI agents and the organic advisor, all in motion.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5"
              >
                Open the Live Dashboard
                <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/iot"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-8 py-4 text-base font-semibold hover:bg-accent transition-colors"
              >
                <Brain className="size-5 text-primary" />
                AI Organic Advisor
              </Link>
            </div>
            <div className="mt-10 text-xs text-muted-foreground">
              ENTOTO Riverside Farm · Entoto Mountain, Addis Ababa · 2,800 m · 4.2 ha · 100% organic
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className={`${SECTION} flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground`}>
          <div className="flex items-center gap-2">
            <Leaf className="size-4 text-primary" />
            <span className="font-semibold text-foreground">ENTOTO Riverside Farm</span>
            <span>· Smart Organic Operations</span>
          </div>
          <div>Operated by Entoto Agro PLC · Built for Ethiopian highland horticulture</div>
        </div>
      </footer>
    </div>
  );
}

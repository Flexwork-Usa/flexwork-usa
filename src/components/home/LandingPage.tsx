"use client";

import { CompanySlider } from "@/components/home/CompanySlider";
import { pageFrame } from "@/lib/frame";
import { motion } from "framer-motion";
import { BadgeCheck, Clock3, Handshake, Layers3, MessagesSquare, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const heroButton =
  "inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#7A320C] transition-colors hover:bg-orange-50";

const heroOutline =
  "inline-flex items-center justify-center rounded-lg border border-white/40 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10";

const tiers = [
  {
    title: "Tier 1: Curated Web Jobs",
    body: "Verified remote roles sourced across the web. Free for workers to apply.",
    icon: Layers3,
  },
  {
    title: "Tier 2: Client Affiliate Projects",
    body: "High-demand, hourly compensated client tasks executed through our platform. Protected by our quality token system to filter out spammers.",
    icon: Handshake,
  },
  {
    title: "Tier 3: AI Platform Partners",
    body: "Direct access to top AI evaluation platforms like Outlier AI & Handshake DA, complete with step-by-step application, CV, and KYC preparation guides.",
    icon: BadgeCheck,
  },
];

const reasons = [
  {
    title: "Fair Token Application System",
    body: "Small token commitment ($0.20/token) ensures client jobs get serious applicants and faster hiring.",
    icon: Wallet,
  },
  {
    title: "Comprehensive Application Support",
    body: "Built-in guides to help you pass assessments, optimize CVs, and verify KYC seamlessly.",
    icon: ShieldCheck,
  },
  {
    title: "Verified Client Payouts",
    body: "Secure, predictable hourly tracking and prompt payouts.",
    icon: Clock3,
  },
  {
    title: "Thriving Community",
    body: "Direct Discord community support to collaborate and share platform assessment tips.",
    icon: MessagesSquare,
  },
];

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const copy = copyRef.current;
    const photo = photoRef.current;
    if (!section || !copy || !photo) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
      copy.style.transform = `translate3d(0, ${progress * 72}px, 0)`;
      copy.style.opacity = String(1 - progress * 0.85);
      photo.style.transform = `translate3d(0, ${progress * -88}px, 0) scale(${1 + progress * 0.06})`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="-mt-16 overflow-hidden bg-gradient-to-br from-[#A34A12] via-[#8A3B0E] to-[#6E2E0B] text-white"
    >
      <div className={`${pageFrame} relative grid items-center gap-10 pt-28 pb-16 sm:pt-36 sm:pb-24 lg:grid-cols-2`}>
        <div ref={copyRef}>
          <div>
            <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white">
              ⚡ Premier Remote Work Marketplace
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Flexible Remote Work for Quality Annotators & Freelancers
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/80">
              Connect directly with verified client projects, curated remote opportunities, and leading AI training
              platforms—all in one structured marketplace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/onboard" className={heroButton}>
                Get Started
              </a>
              <a href="/jobs" className={heroOutline}>
                Explore Jobs
              </a>
            </div>
            <ul className="mt-10 grid gap-3 sm:grid-cols-3">
              {metrics.map((label) => (
                <li key={label} className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-medium text-white">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div ref={photoRef} className="origin-center will-change-transform">
          <img
            src="https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&w=1600&q=80"
            alt="A young woman working on a laptop in a bright room"
            className="h-full max-h-[32rem] w-full rounded-2xl border border-white/20 object-cover shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
}

const metrics = ["3 Project Tiers", "Guaranteed Compensation", "Vetted Quality"];

export function LandingPage() {
  return (
    <div className="relative bg-gradient-to-br from-white via-orange-50/40 to-white text-slate-900">
      <Hero />

      <CompanySlider />

      <section>
        <div className={`${pageFrame} py-16`}>
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How Flexwork-USA Works</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Three marketplace tiers, each with a clear way to apply.</p>
          </Reveal>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {tiers.map((tier) => (
              <Reveal key={tier.title}>
                <article className="h-full rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <tier.icon className="h-5 w-5 text-[#C85A17]" aria-hidden />
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{tier.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{tier.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200">
        <div className={`${pageFrame} py-16`}>
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Why Quality Workers Choose Us</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {reasons.map((reason) => (
              <Reveal key={reason.title}>
                <article className="h-full rounded-xl border border-slate-200 bg-white p-5">
                  <reason.icon className="h-5 w-5 text-[#C85A17]" aria-hidden />
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{reason.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{reason.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className={`${pageFrame} pb-16`}>
        <Reveal>
          <div className="rounded-2xl bg-[#C85A17] px-6 py-10 text-white sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to Start Working Remotely?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/90">
              Create your account and start applying to featured remote tasks.
            </p>
            <a
              href="/onboard"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-[#C85A17] transition-colors hover:bg-slate-50"
            >
              Get Started
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

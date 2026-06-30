'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import {
  Zap,
  MessageSquare,
  Users,
  Megaphone,
  BarChart2,
  Shield,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import ThemeToggle from '@/components/common/ThemeToggle';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Unified Inbox',
    description: 'Every WhatsApp conversation in one workspace. Assign to agents, reply instantly, never miss a lead.',
    color: 'green',
    stat: '< 2s',
    statLabel: 'avg response time',
  },
  {
    icon: Megaphone,
    title: 'Broadcast Campaigns',
    description: 'Reach thousands of opted-in contacts with a single send. Watch delivery tick up in real time.',
    color: 'purple',
    stat: '94%',
    statLabel: 'avg open rate',
  },
  {
    icon: Users,
    title: 'Contact CRM',
    description: 'Tag, segment, and import your audience. Build lists by behaviour, not just by name.',
    color: 'green',
    stat: '∞',
    statLabel: 'contacts per workspace',
  },
  {
    icon: BarChart2,
    title: 'Live Analytics',
    description: 'Delivery rates, agent performance, message volume — updated continuously, not nightly.',
    color: 'purple',
    stat: '5',
    statLabel: 'KPI dashboards',
  },
  {
    icon: Shield,
    title: 'Multi-tenant',
    description: 'Full data isolation per business. Every tenant gets their own sessions, contacts, and history.',
    color: 'green',
    stat: '100%',
    statLabel: 'data isolated',
  },
  {
    icon: Zap,
    title: 'Real-time Engine',
    description: 'WebSocket delivery acks, live campaign progress, instant inbox updates — built on Baileys.',
    color: 'purple',
    stat: '99.9%',
    statLabel: 'uptime SLA',
  },
];

const TESTIMONIALS = [
  {
    quote: 'We replaced three separate tools with NotifyTechAI. Our team now handles 4× the conversations.',
    name: 'Priya Sharma',
    role: 'Ops Lead, D2C Brand — Delhi',
    initials: 'PS',
  },
  {
    quote: 'Campaigns that used to take a day to set up now take 10 minutes. The CSV upload alone saves us hours.',
    name: 'Rahul Mehra',
    role: 'Founder, EdTech Startup — Pune',
    initials: 'RM',
  },
  {
    quote: 'Finally a WhatsApp tool that actually shows me whether messages were read, not just sent.',
    name: 'Ankit Joshi',
    role: 'Growth Manager, Retail Chain — Mumbai',
    initials: 'AJ',
  },
];

const STATS = [
  { value: '10k+', label: 'Messages sent daily' },
  { value: '< 3s', label: 'Delivery latency' },
  { value: '94%', label: 'Avg campaign open rate' },
  { value: '99.9%', label: 'Platform uptime' },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut', delay: i * 0.08 },
  }),
};

// ─── Components ───────────────────────────────────────────────────────────────

function GlowOrb({
  x,
  y,
  variant = 'green',
  size = 480,
}: {
  x: string;
  y: string;
  variant?: 'green' | 'purple';
  size?: number;
}) {
  const colorClass = variant === 'green' ? 'bg-[hsl(var(--green))]' : 'bg-[hsl(var(--purple))]';
  return (
    <div
      aria-hidden="true"
      className={`absolute rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 opacity-[0.10] dark:opacity-[0.14] ${colorClass}`}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        filter: `blur(${size * 0.45}px)`,
      }}
    />
  );
}

function FeatureCard({ feature, index }: { feature: (typeof FEATURES)[0]; index: number }) {
  const Icon = feature.icon;
  const isGreen = feature.color === 'green';

  return (
    <motion.div
      variants={fadeUp}
      custom={index % 3}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 pb-8 shadow-[var(--shadow-sm)]"
    >
      {/* Subtle top-edge glow */}
      <div
        aria-hidden
        className={`absolute top-0 left-[20%] right-[20%] h-px ${
          isGreen
            ? 'bg-gradient-to-r from-transparent via-[hsl(var(--green)/0.6)] to-transparent'
            : 'bg-gradient-to-r from-transparent via-[hsl(var(--purple)/0.6)] to-transparent'
        }`}
      />

      {/* Icon */}
      <div
        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl border ${
          isGreen
            ? 'bg-[hsl(var(--green)/0.1)] border-[hsl(var(--green)/0.2)]'
            : 'bg-[hsl(var(--purple)/0.1)] border-[hsl(var(--purple)/0.2)]'
        }`}
      >
        <Icon size={20} className={isGreen ? 'text-[hsl(var(--green))]' : 'text-[hsl(var(--purple))]'} />
      </div>

      <h3 className="mb-2 text-[16px] font-[600] tracking-[-0.015em] text-[hsl(var(--foreground))]">{feature.title}</h3>
      <p className="mb-5 text-[14px] leading-[1.7] text-[hsl(var(--muted-foreground))]">{feature.description}</p>

      {/* Mini stat */}
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-[22px] font-[700] tracking-[-0.03em] ${
            isGreen ? 'text-[hsl(var(--green))]' : 'text-[hsl(var(--purple))]'
          }`}
        >
          {feature.stat}
        </span>
        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{feature.statLabel}</span>
      </div>
    </motion.div>
  );
}

function TestimonialCard({ t, index }: { t: (typeof TESTIMONIALS)[0]; index: number }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      className="flex flex-col gap-5 rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 pb-8 shadow-[var(--shadow-sm)]"
    >
      {/* Quote mark */}
      <div className="font-serif text-[40px] leading-none text-[hsl(var(--green)/0.5)]">&ldquo;</div>
      <p className="-mt-4 text-[15px] leading-[1.7] text-[hsl(var(--foreground))]">{t.quote}</p>
      <div className="mt-auto flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[hsl(var(--green)/0.2)] bg-[hsl(var(--green)/0.12)] text-[12px] font-[700] text-[hsl(var(--green))]">
          {t.initials}
        </div>
        <div>
          <p className="mb-0.5 text-[13px] font-[600] text-[hsl(var(--foreground))]">{t.name}</p>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">{t.role}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const [navSolid, setNavSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased">
      {/* ── Nav ── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed inset-x-0 top-0 z-[100] transition-colors duration-300 ${
          navSolid
            ? 'border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.92)] backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[hsl(var(--green))]">
              <Zap size={17} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-[700] tracking-[-0.02em] text-[hsl(var(--foreground))]">
              NotifyTechAI
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-[10px] px-[18px] py-2 text-[14px] font-[500] text-[hsl(var(--muted-foreground))] no-underline hover:text-[hsl(var(--foreground))]"
            >
              Sign in
            </Link>
            <ThemeToggle />
            <Link
              href="/register"
              className="rounded-[10px] bg-[hsl(var(--green))] px-5 py-2 text-[14px] font-[600] text-white no-underline shadow-[0_0_20px_hsl(var(--green)/0.35)]"
            >
              Get started
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        {/* Background orbs */}
        <GlowOrb x="20%" y="30%" variant="green" size={600} />
        <GlowOrb x="80%" y="60%" variant="purple" size={500} />
        <GlowOrb x="50%" y="80%" variant="green" size={300} />

        {/* Grid overlay */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-60 dark:opacity-100"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%)',
          }}
        />

        <motion.div style={{ opacity: heroOpacity, y: heroY }} transition={{ type: 'spring' }}>
          <div className="relative z-[1] mx-auto max-w-[860px] px-6 text-center">
            {/* Eyebrow */}
            <motion.div
              variants={fadeUp}
              custom={0}
              initial="hidden"
              animate="visible"
              className="mb-9 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--green)/0.3)] bg-[hsl(var(--green)/0.07)] px-4 py-1.5 text-[12px] font-[600] uppercase tracking-[0.06em] text-[hsl(var(--green))]"
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[hsl(var(--green))]"
              />
              WhatsApp Business Platform for Indian SMBs
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
              className="mx-auto mb-7 text-[clamp(2.6rem,7vw,4.5rem)] font-[800] leading-[1.05] tracking-[-0.04em] text-[hsl(var(--foreground))]"
            >
              WhatsApp conversations,{' '}
              <span className="bg-gradient-to-br from-[hsl(var(--green))] to-[hsl(var(--purple))] bg-clip-text text-transparent">
                at business scale
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="mx-auto mb-12 max-w-[580px] text-[18px] leading-[1.7] text-[hsl(var(--muted-foreground))]"
            >
              Connect your number, manage every conversation, run personalised broadcast campaigns, and track delivery —
              all in one dashboard built for the speed of Indian business.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--green))] px-7 py-[13px] text-[15px] font-[700] text-white no-underline shadow-[0_0_40px_hsl(var(--green)/0.4)]"
                >
                  Start for free
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-7 py-[13px] text-[15px] font-[500] text-[hsl(var(--foreground))] no-underline"
                >
                  Sign in
                </Link>
              </motion.div>
            </motion.div>

            {/* Trust line */}
            <motion.div
              variants={fadeUp}
              custom={4}
              initial="hidden"
              animate="visible"
              className="mt-7 flex flex-wrap items-center justify-center gap-5"
            >
              {['No credit card needed', 'Setup in 5 minutes', 'Cancel anytime'].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[13px] text-[hsl(var(--muted-foreground))]">
                  <CheckCircle2 size={13} className="text-[hsl(var(--green))]" />
                  {item}
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="absolute bottom-9 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
        >
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
            <ChevronDown size={18} className="text-[hsl(var(--muted-foreground))]" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="relative overflow-hidden border-y border-[hsl(var(--border))] px-6 py-14">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--green)/0.03)] to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-l from-transparent via-[hsl(var(--purple)/0.03)] to-transparent"
        />
        <div className="relative z-[1] mx-auto grid max-w-[900px] grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="mb-2 bg-gradient-to-br from-[hsl(var(--green))] to-[hsl(var(--purple))] bg-clip-text text-[36px] font-[800] leading-none tracking-[-0.04em] text-transparent">
                {stat.value}
              </p>
              <p className="m-0 text-[13px] tracking-[0.01em] text-[hsl(var(--muted-foreground))]">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-[1140px] px-6 py-28">
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-[72px] text-center"
        >
          <p className="mb-4 text-[11px] font-[700] uppercase tracking-[0.12em] text-[hsl(var(--green))]">
            Platform capabilities
          </p>
          <h2 className="mx-auto mb-5 max-w-[640px] text-[clamp(1.8rem,4vw,2.8rem)] font-[800] leading-[1.15] tracking-[-0.03em] text-[hsl(var(--foreground))]">
            Everything your team needs to run WhatsApp like a pro
          </h2>
          <p className="mx-auto max-w-[480px] text-[16px] leading-[1.7] text-[hsl(var(--muted-foreground))]">
            One platform that replaces your manual WhatsApp workflow, your broadcast spreadsheet, and your support
            inbox.
          </p>
        </motion.div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={i} feature={feature} index={i} />
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="relative overflow-hidden border-t border-[hsl(var(--border))] px-6 py-28">
        <GlowOrb x="50%" y="50%" variant="purple" size={700} />

        <div className="relative z-[1] mx-auto max-w-[1140px]">
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <p className="mb-4 text-[11px] font-[700] uppercase tracking-[0.12em] text-[hsl(var(--purple))]">
              Early feedback
            </p>
            <h2 className="m-0 text-[clamp(1.8rem,4vw,2.6rem)] font-[800] leading-[1.15] tracking-[-0.03em] text-[hsl(var(--foreground))]">
              Teams switching from manual WhatsApp
            </h2>
          </motion.div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
            {TESTIMONIALS.map((t, i) => (
              <TestimonialCard key={i} t={t} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden border-t border-[hsl(var(--border))] px-6 pb-32 pt-28">
        <GlowOrb x="50%" y="50%" variant="green" size={800} />

        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative z-[1] mx-auto max-w-[640px] text-center"
        >
          <p className="mb-5 text-[11px] font-[700] uppercase tracking-[0.12em] text-[hsl(var(--green))]">
            Get started today
          </p>
          <h2 className="mb-6 text-[clamp(2rem,5vw,3.4rem)] font-[800] leading-[1.1] tracking-[-0.04em] text-[hsl(var(--foreground))]">
            Your next customer is already on WhatsApp
          </h2>
          <p className="mb-12 text-[17px] leading-[1.7] text-[hsl(var(--muted-foreground))]">
            Join the businesses using NotifyTechAI to turn WhatsApp into their highest-converting channel.
          </p>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
            <Link
              href="/register"
              className="inline-flex items-center gap-2.5 rounded-[14px] bg-[hsl(var(--green))] px-9 py-4 text-[16px] font-[700] tracking-[-0.01em] text-white no-underline shadow-[0_0_60px_hsl(var(--green)/0.4)]"
            >
              Start for free
              <ArrowRight size={18} />
            </Link>
          </motion.div>

          <p className="mt-5 text-[13px] text-[hsl(var(--muted-foreground))]">
            No credit card required · Set up in 5 minutes
          </p>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[hsl(var(--border))] px-6 py-8">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[hsl(var(--green))]">
              <Zap size={13} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[14px] font-[700] tracking-[-0.01em] text-[hsl(var(--foreground))]">
              NotifyTechAI
            </span>
          </div>
          <p className="m-0 text-[13px] text-[hsl(var(--muted-foreground))]">
            © {new Date().getFullYear()} NotifyTechAI · Built for Indian businesses
          </p>
        </div>
      </footer>
    </div>
  );
}

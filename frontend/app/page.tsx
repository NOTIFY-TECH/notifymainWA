'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence, type Variants } from 'framer-motion';
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

// ─── Design tokens (mirror globals.css values) ────────────────────────────────

const C = {
  bg: 'hsl(215 28% 7%)',
  card: 'hsl(215 28% 11%)',
  border: 'hsl(215 28% 16%)',
  muted: 'hsl(215 16% 47%)',
  fg: 'hsl(213 31% 91%)',
  green: 'hsl(134 61% 41%)',
  purple: 'hsl(263 70% 56%)',
};

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

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

// ─── Components ───────────────────────────────────────────────────────────────

function GlowOrb({
  x,
  y,
  color,
  size = 480,
  opacity = 0.18,
}: {
  x: string;
  y: string;
  color: string;
  size?: number;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        opacity,
        filter: `blur(${size * 0.45}px)`,
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
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
      style={{
        padding: '28px 28px 32px',
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        backgroundColor: C.card,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* Subtle top-edge glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: 1,
          background: isGreen
            ? 'linear-gradient(90deg, transparent, hsl(134 61% 41% / 0.6), transparent)'
            : 'linear-gradient(90deg, transparent, hsl(263 70% 56% / 0.6), transparent)',
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: isGreen ? 'hsl(134 61% 41% / 0.1)' : 'hsl(263 70% 56% / 0.1)',
          border: `1px solid ${isGreen ? 'hsl(134 61% 41% / 0.2)' : 'hsl(263 70% 56% / 0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Icon size={20} color={isGreen ? C.green : C.purple} />
      </div>

      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          marginBottom: 8,
          color: C.fg,
        }}
      >
        {feature.title}
      </h3>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: C.muted,
          marginBottom: 20,
        }}
      >
        {feature.description}
      </p>

      {/* Mini stat */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: isGreen ? C.green : C.purple,
          }}
        >
          {feature.stat}
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>{feature.statLabel}</span>
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
      style={{
        padding: '28px 28px 32px',
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        backgroundColor: C.card,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Quote marks */}
      <div style={{ fontSize: 40, lineHeight: 1, color: C.green, fontFamily: 'Georgia, serif', opacity: 0.5 }}>
        &ldquo;
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: C.fg, marginTop: -16 }}>{t.quote}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'hsl(134 61% 41% / 0.12)',
            border: '1px solid hsl(134 61% 41% / 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: C.green,
            flexShrink: 0,
          }}
        >
          {t.initials}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.fg, marginBottom: 1 }}>{t.name}</p>
          <p style={{ fontSize: 12, color: C.muted }}>{t.role}</p>
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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: C.bg,
        color: C.fg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        overflowX: 'hidden',
      }}
    >
      {/* ── Nav ── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          borderBottom: navSolid ? `1px solid ${C.border}` : '1px solid transparent',
          backgroundColor: navSolid ? 'hsl(215 28% 7% / 0.92)' : 'transparent',
          backdropFilter: navSolid ? 'blur(20px)' : 'none',
          transition: 'background-color 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        }}
      >
        <div
          style={{
            maxWidth: 1140,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: C.green,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={17} color="hsl(134 100% 5%)" strokeWidth={2.5} />
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '-0.02em',
                color: C.fg,
              }}
            >
              NotifyTechAI
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link
              href="/login"
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                color: C.muted,
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: C.green,
                color: 'hsl(134 100% 5%)',
                textDecoration: 'none',
                boxShadow: '0 0 20px hsl(134 61% 41% / 0.35)',
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          paddingTop: 64,
        }}
      >
        {/* Background orbs */}
        <GlowOrb x="20%" y="30%" color={C.green} size={600} opacity={0.12} />
        <GlowOrb x="80%" y="60%" color={C.purple} size={500} opacity={0.12} />
        <GlowOrb x="50%" y="80%" color={C.green} size={300} opacity={0.07} />

        {/* Grid overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(hsl(215 28% 20% / 0.15) 1px, transparent 1px),
              linear-gradient(90deg, hsl(215 28% 20% / 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%)',
          }}
        />

        <motion.div style={{ opacity: heroOpacity, y: heroY }} transition={{ type: 'spring' }}>
          <div
            style={{
              maxWidth: 860,
              margin: '0 auto',
              padding: '0 24px',
              textAlign: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Eyebrow */}
            <motion.div
              variants={fadeUp}
              custom={0}
              initial="hidden"
              animate="visible"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                borderRadius: 999,
                border: '1px solid hsl(134 61% 41% / 0.3)',
                backgroundColor: 'hsl(134 61% 41% / 0.07)',
                fontSize: 12,
                fontWeight: 600,
                color: C.green,
                marginBottom: 36,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: C.green,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              WhatsApp Business Platform for Indian SMBs
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
              style={{
                fontSize: 'clamp(2.6rem, 7vw, 4.5rem)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                margin: '0 auto 28px',
                color: C.fg,
              }}
            >
              WhatsApp conversations,{' '}
              <span
                style={{
                  background: `linear-gradient(135deg, ${C.green}, ${C.purple})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                at business scale
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              style={{
                fontSize: 18,
                lineHeight: 1.7,
                color: C.muted,
                maxWidth: 580,
                margin: '0 auto 48px',
              }}
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/register"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '13px 28px',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    backgroundColor: C.green,
                    color: 'hsl(134 100% 5%)',
                    textDecoration: 'none',
                    boxShadow: '0 0 40px hsl(134 61% 41% / 0.4)',
                  }}
                >
                  Start for free
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '13px 28px',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 500,
                    border: `1px solid ${C.border}`,
                    color: C.fg,
                    textDecoration: 'none',
                    backgroundColor: C.card,
                  }}
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
              style={{
                marginTop: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              {['No credit card needed', 'Setup in 5 minutes', 'Cancel anytime'].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: C.muted,
                  }}
                >
                  <CheckCircle2 size={13} color={C.green} />
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
          style={{
            position: 'absolute',
            bottom: 36,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
            <ChevronDown size={18} color={C.muted} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section
        style={{
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: '56px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, transparent, hsl(134 61% 41% / 0.03), hsl(263 70% 56% / 0.03), transparent)`,
          }}
        />
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 32,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              style={{ textAlign: 'center' }}
            >
              <p
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  marginBottom: 8,
                  background: `linear-gradient(135deg, ${C.green}, ${C.purple})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {stat.value}
              </p>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, letterSpacing: '0.01em' }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '112px 24px' }}>
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 72 }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: C.green,
              marginBottom: 16,
            }}
          >
            Platform capabilities
          </p>
          <h2
            style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 auto 20px',
              maxWidth: 640,
              lineHeight: 1.15,
            }}
          >
            Everything your team needs to run WhatsApp like a pro
          </h2>
          <p
            style={{
              fontSize: 16,
              color: C.muted,
              maxWidth: 480,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            One platform that replaces your manual WhatsApp workflow, your broadcast spreadsheet, and your support
            inbox.
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {FEATURES.map((feature, i) => (
            <FeatureCard key={i} feature={feature} index={i} />
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: '112px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <GlowOrb x="50%" y="50%" color={C.purple} size={700} opacity={0.06} />

        <div style={{ maxWidth: 1140, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: C.purple,
                marginBottom: 16,
              }}
            >
              Early feedback
            </p>
            <h2
              style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Teams switching from manual WhatsApp
            </h2>
          </motion.div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            {TESTIMONIALS.map((t, i) => (
              <TestimonialCard key={i} t={t} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: '112px 24px 128px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <GlowOrb x="50%" y="50%" color={C.green} size={800} opacity={0.07} />

        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            maxWidth: 640,
            margin: '0 auto',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: C.green,
              marginBottom: 20,
            }}
          >
            Get started today
          </p>
          <h2
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.4rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            Your next customer is already on WhatsApp
          </h2>
          <p
            style={{
              fontSize: 17,
              color: C.muted,
              lineHeight: 1.7,
              marginBottom: 48,
            }}
          >
            Join the businesses using NotifyTechAI to turn WhatsApp into their highest-converting channel.
          </p>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
            <Link
              href="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '16px 36px',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                backgroundColor: C.green,
                color: 'hsl(134 100% 5%)',
                textDecoration: 'none',
                boxShadow: '0 0 60px hsl(134 61% 41% / 0.4)',
                letterSpacing: '-0.01em',
              }}
            >
              Start for free
              <ArrowRight size={18} />
            </Link>
          </motion.div>

          <p style={{ marginTop: 20, fontSize: 13, color: C.muted }}>No credit card required · Set up in 5 minutes</p>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1140,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                backgroundColor: C.green,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={13} color="hsl(134 100% 5%)" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>NotifyTechAI</span>
          </div>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
            © {new Date().getFullYear()} NotifyTechAI · Built for Indian businesses
          </p>
        </div>
      </footer>
    </div>
  );
}

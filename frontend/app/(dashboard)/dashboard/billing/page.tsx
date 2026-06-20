'use client';

import { useAuthStore } from '@/store/authStore';
import { CreditCard, Receipt, Download, CheckCircle2, Clock, Calendar, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const INVOICES = [
  { id: 'INV-2026-003', date: 'Jun 01, 2026', amount: 49.0, status: 'paid' },
  { id: 'INV-2026-002', date: 'May 01, 2026', amount: 49.0, status: 'paid' },
  { id: 'INV-2026-001', date: 'Apr 01, 2026', amount: 49.0, status: 'paid' },
];

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard() {
  return (
    <div className="glass rounded-[var(--radius)] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Pro Plan</h2>
          <span className="inline-flex items-center rounded-full bg-[hsl(var(--green-dim))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--green))]">
            Active
          </span>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          You are currently on the Pro tier. Next billing date is{' '}
          <strong className="text-[hsl(var(--foreground))]">July 01, 2026</strong>.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
        <div className="text-right mr-4 hidden md:block">
          <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
            $49<span className="text-sm text-[hsl(var(--muted-foreground))] font-normal"> / mo</span>
          </p>
        </div>
        <button className="w-full sm:w-auto px-4 py-2 rounded-[var(--radius)] bg-[hsl(var(--foreground))] text-[hsl(var(--background))] text-sm font-medium hover:opacity-90 transition-opacity">
          Manage Plan
        </button>
      </div>
    </div>
  );
}

// ─── Billing Page ─────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { tenant } = useAuthStore();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            <span className="gradient-text">Billing & Subscription</span>
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Manage your payment methods and billing history for {tenant?.name ?? 'your workspace'}.
          </p>
        </div>
      </div>

      {/* ── Demo Notice Banner ── */}
      <div className="flex items-start sm:items-center gap-3 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <AlertCircle size={18} className="shrink-0 text-[hsl(var(--foreground))]" />
        <p>
          <strong className="text-[hsl(var(--foreground))] font-medium">Demo Page:</strong> This billing interface is
          currently in read-only preview mode. No actual charges will be processed, and payment methods cannot be
          updated at this time.
        </p>
      </div>

      {/* ── Current Plan ── */}
      <PlanCard />

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Method */}
        <div className="glass card-hover rounded-[var(--radius)] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Payment Method</p>
            <CreditCard size={18} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-16 items-center justify-center rounded bg-[hsl(var(--muted))] border border-[hsl(var(--border))]">
              <span className="font-bold text-[hsl(var(--foreground))] text-sm italic">VISA</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">Visa ending in 4242</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Expires 12/28</p>
            </div>
          </div>
          <div className="mt-2 pt-4 border-t border-[hsl(var(--border))]">
            <button className="text-sm font-medium text-[hsl(var(--muted-foreground))] cursor-not-allowed opacity-70">
              Update payment method (Disabled)
            </button>
          </div>
        </div>

        {/* Usage Summary */}
        <div className="glass card-hover rounded-[var(--radius)] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Monthly Usage</p>
            <Zap size={18} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[hsl(var(--muted-foreground))]">Messages Included</span>
                <span className="font-medium text-[hsl(var(--foreground))]">45k / 50k</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <div className="h-full bg-[hsl(var(--green))] w-[90%]" />
              </div>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Usage resets on the 1st of every month.</p>
          </div>
        </div>
      </div>

      {/* ── Billing History ── */}
      <div className="glass rounded-[var(--radius)] p-5">
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Billing History</h2>

        {INVOICES.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <Receipt size={32} className="text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No billing history available yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="pb-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="pb-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      Date
                    </span>
                  </th>
                  <th className="pb-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="pb-3 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="pb-3 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {INVOICES.map(invoice => (
                  <tr key={invoice.id} className="group hover:bg-[hsl(var(--muted)/0.4)] transition-colors">
                    <td className="py-3 pr-4 font-medium text-[hsl(var(--foreground))]">{invoice.id}</td>
                    <td className="py-3 text-[hsl(var(--muted-foreground))]">{invoice.date}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--green-dim))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--green))]">
                        <CheckCircle2 size={12} />
                        {invoice.status}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium text-[hsl(var(--foreground))]">
                      ${invoice.amount.toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      <button className="inline-flex items-center justify-center p-1.5 rounded-[var(--radius)] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

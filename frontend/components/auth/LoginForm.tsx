'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const { globalLogin, isGlobalLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => {
    globalLogin({ email: values.email, password: values.password });
  };

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">Welcome back</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Sign in to your NotifyTechAI account</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            className={cn(
              'w-full h-11 rounded-xl px-4 text-sm',
              'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
              'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
              'focus:outline-none focus:border-[hsl(var(--green))] focus:ring-1 focus:ring-[hsl(var(--green))]',
              'transition-all duration-150',
              errors.email && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            )}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Password
            </label>
            <Link href="/reset-password" className="text-xs text-[hsl(var(--green))] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              className={cn(
                'w-full h-11 rounded-xl px-4 pr-11 text-sm',
                'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
                'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
                'focus:outline-none focus:border-[hsl(var(--green))] focus:ring-1 focus:ring-[hsl(var(--green))]',
                'transition-all duration-150',
                errors.password && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isGlobalLoggingIn}
          className={cn(
            'w-full h-11 rounded-xl text-sm font-semibold',
            'bg-[#22C55E] text-white',
            'hover:bg-[#16a34a] active:scale-[0.98]',
            'transition-all duration-150',
            'flex items-center justify-center gap-2',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {isGlobalLoggingIn ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-[hsl(var(--green))] hover:underline font-semibold">
          Create one free
        </Link>
      </p>
    </div>
  );
}

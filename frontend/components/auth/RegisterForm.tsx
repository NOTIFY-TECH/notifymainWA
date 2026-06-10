'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, Loader2, ArrowRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const registerSchema = z
  .object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters').max(100),
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    email: z.string().email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const inputClass = (hasError?: boolean) =>
  cn(
    'w-full h-11 rounded-xl px-4 text-sm',
    'bg-[hsl(var(--muted))] border border-[hsl(var(--border))]',
    'text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
    'focus:outline-none focus:border-[hsl(var(--green))] focus:ring-1 focus:ring-[hsl(var(--green))]',
    'transition-all duration-150',
    hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
  );

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]';

export default function RegisterForm() {
  const { signup, isSigningUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      businessName: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    signup({
      businessName: values.businessName,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
    });
  };

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">Create your account</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Start your free trial — no credit card required</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Business Name */}
        <div className="space-y-1.5">
          <label className={labelClass}>Business Name</label>
          <div className="relative">
            <Building2
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
            />
            <input
              {...register('businessName')}
              placeholder="Acme Pvt Ltd"
              autoComplete="organization"
              className={cn(inputClass(!!errors.businessName), 'pl-9')}
            />
          </div>
          {errors.businessName && <p className="text-xs text-red-500">{errors.businessName.message}</p>}
        </div>

        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>First Name</label>
            <input
              {...register('firstName')}
              placeholder="Yash"
              autoComplete="given-name"
              className={inputClass(!!errors.firstName)}
            />
            {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Last Name</label>
            <input
              {...register('lastName')}
              placeholder="Patel"
              autoComplete="family-name"
              className={inputClass(!!errors.lastName)}
            />
            {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className={labelClass}>Work Email</label>
          <input
            {...register('email')}
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            className={inputClass(!!errors.email)}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className={labelClass}>Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className={cn(inputClass(!!errors.password), 'pr-11')}
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

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className={labelClass}>Confirm Password</label>
          <div className="relative">
            <input
              {...register('confirmPassword')}
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className={cn(inputClass(!!errors.confirmPassword), 'pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSigningUp}
          className={cn(
            'w-full h-11 rounded-xl text-sm font-semibold mt-2',
            'bg-[#22C55E] text-white',
            'hover:bg-[#16a34a] active:scale-[0.98]',
            'transition-all duration-150',
            'flex items-center justify-center gap-2',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {isSigningUp ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="text-[hsl(var(--green))] hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-[hsl(var(--green))] hover:underline">
            Privacy Policy
          </Link>
        </p>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
        Already have an account?{' '}
        <Link href="/login" className="text-[hsl(var(--green))] hover:underline font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}

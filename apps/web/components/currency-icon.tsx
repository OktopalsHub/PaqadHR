'use client';

import type React from 'react';
import { cn } from '@/lib/utils';

export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP' | 'BTC' | 'ETH' | 'USDT' | 'USDC' | string;

interface CurrencyIconProps extends React.SVGProps<SVGSVGElement> {
  code: CurrencyCode;
  className?: string;
  size?: number;
}

export function CurrencyIcon({ code, className, size = 20, ...props }: CurrencyIconProps) {
  const normalized = code.toUpperCase();

  switch (normalized) {
    case 'NGN':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#008751" />
          <path
            d="M9 22V10H11.8L17.2 18.2V10H20V22H17.2L11.8 13.8V22H9Z"
            fill="white"
            fontWeight="bold"
          />
          <path d="M7 14.5H22M7 17.5H22" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'USD':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#10B981" />
          <path
            d="M16 6V26M19.5 10.5C19.5 9.12 17.93 8 16 8C14.07 8 12.5 9.12 12.5 10.5C12.5 11.88 14.07 13 16 13C17.93 13 19.5 14.12 19.5 15.5C19.5 16.88 17.93 18 16 18C14.07 18 12.5 16.88 12.5 15.5M19.5 20.5C19.5 19.12 17.93 18 16 18C14.07 18 12.5 19.12 12.5 20.5C12.5 21.88 14.07 23 16 23C17.93 23 19.5 21.88 19.5 20.5Z"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'EUR':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#003399" />
          <path
            d="M21 10.5C19.8 9.5 18.2 9 16.2 9C12.2 9 9.5 12.1 9.5 16C9.5 19.9 12.2 23 16.2 23C18.2 23 19.8 22.5 21 21.5"
            stroke="#FFCC00"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M8 14.5H18M8 17.5H18" stroke="#FFCC00" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'GBP':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#012169" />
          <path
            d="M20 10C18.5 8.5 16 8.5 14.5 10C13 11.5 13 13.5 13 16V22H21M10 16.5H18"
            stroke="#C8102E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'BTC':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            d="M21.2 13.3C21.5 11.8 20.3 10.9 18.7 10.4L19.2 8.3L17.9 8L17.4 10.1C17 10 16.7 9.9 16.3 9.8L16.8 7.7L15.5 7.4L15 9.5C14.7 9.4 14.4 9.4 14.2 9.3L12.4 8.8L12 10.3C12 10.3 13.1 10.6 13 10.6C13.6 10.8 13.7 11.2 13.6 11.6L12.9 14.5C12.9 14.5 13 14.5 13 14.6C13 14.5 12.9 14.5 12.9 14.5L11.9 18.5C11.8 18.9 11.5 19.3 10.9 19.1C10.9 19.1 9.8 18.8 9.8 18.8L9.2 20.3L10.9 20.7C11.2 20.8 11.6 20.9 11.9 21L11.4 23.1L12.7 23.4L13.2 21.3C13.6 21.4 13.9 21.5 14.3 21.6L13.8 23.7L15.1 24L15.6 21.9C18 22.3 19.8 22.1 20.6 19.9C21.2 18.2 20.6 17.2 19.4 16.5C20.3 16 20.9 15 21.2 13.3ZM18.1 18.7C17.6 20.6 14.5 19.6 13.6 19.4L14.3 16.6C15.2 16.8 18.6 16.7 18.1 18.7ZM18.6 13.5C18.2 15.2 15.6 14.4 14.8 14.2L15.4 11.8C16.2 12 19 11.8 18.6 13.5Z"
            fill="white"
          />
        </svg>
      );

    case 'ETH':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path d="M16 4L15.7 5V19.3L16 19.6L22.5 15.7L16 4Z" fill="white" fillOpacity="0.6" />
          <path d="M16 4L9.5 15.7L16 19.6V12.4V4Z" fill="white" />
          <path d="M16 21L15.8 21.2V27.5L16 28L22.5 18.8L16 21Z" fill="white" fillOpacity="0.6" />
          <path d="M16 28V21L9.5 18.8L16 28Z" fill="white" />
          <path d="M16 19.6L22.5 15.7L16 12.4V19.6Z" fill="white" fillOpacity="0.2" />
          <path d="M9.5 15.7L16 19.6V12.4L9.5 15.7Z" fill="white" fillOpacity="0.6" />
        </svg>
      );

    case 'USDT':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#26A17B" />
          <path
            d="M17.9 15.2C17.7 15.2 17.2 15.3 16 15.3C14.7 15.3 14.3 15.2 14.1 15.2C11.9 15.1 10.3 14.6 10.3 14C10.3 13.3 11.9 12.9 14.1 12.8V10.2H8.8V7.5H23.2V10.2H17.9V12.8C20.1 12.9 21.7 13.3 21.7 14C21.7 14.6 20.1 15.1 17.9 15.2ZM17.9 16.5C19.7 16.3 21.7 15.8 21.7 14.9V18.8C21.7 19.8 19.1 20.6 16 20.6C12.9 20.6 10.3 19.8 10.3 18.8V14.9C10.3 15.8 12.3 16.3 14.1 16.5V24.5H17.9V16.5Z"
            fill="white"
          />
        </svg>
      );

    case 'USDC':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0 rounded-full', className)}
          {...props}
        >
          <circle cx="16" cy="16" r="16" fill="#2775CA" />
          <path
            d="M16 6C10.5 6 6 10.5 6 16C6 21.5 10.5 26 16 26C21.5 26 26 21.5 26 16C26 10.5 21.5 6 16 6ZM16 24C11.6 24 8 20.4 8 16C8 11.6 11.6 8 16 8C20.4 8 24 11.6 24 16C24 20.4 20.4 24 16 24Z"
            fill="white"
            fillOpacity="0.4"
          />
          <path
            d="M16.8 18.9C15.2 18.9 14.3 18.1 14.3 17.1C14.3 16 15.2 15.4 16.8 15.1L17.7 14.9C18.6 14.7 19.1 14.2 19.1 13.4C19.1 12.4 18 11.7 16.3 11.7C14.8 11.7 13.8 12.3 13.5 13.2H11.7C12.1 11.3 13.8 9.9 16 9.9V8.5H17.5V9.9C19.4 10.1 20.9 11.4 20.9 13.3C20.9 15 19.7 16.1 17.9 16.4L16.9 16.6C16.1 16.8 15.6 17.2 15.6 17.9C15.6 18.8 16.8 19.4 18.2 19.4C19.7 19.4 20.8 18.7 21.2 17.7H22.9C22.4 19.8 20.6 21.1 18.5 21.2V22.5H16.9V21.2C14.7 21 13.1 19.6 13.1 17.5H13.1C13.1 17.5 16.8 18.9 16.8 18.9Z"
            fill="white"
          />
        </svg>
      );

    default:
      return (
        <div
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white',
            className,
          )}
          style={{ width: size, height: size }}
        >
          {normalized.slice(0, 2)}
        </div>
      );
  }
}

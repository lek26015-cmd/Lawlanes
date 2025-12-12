import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(value: string) {
  const phoneNumber = value.replace(/\D/g, '');
  if (phoneNumber.length < 4) return phoneNumber;
  if (phoneNumber.length < 7) return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}

export function formatBankAccount(value: string) {
  const bankAccount = value.replace(/\D/g, '');
  if (bankAccount.length < 4) return bankAccount;
  if (bankAccount.length < 5) return `${bankAccount.slice(0, 3)}-${bankAccount.slice(3)}`;
  if (bankAccount.length < 10) return `${bankAccount.slice(0, 3)}-${bankAccount.slice(3, 4)}-${bankAccount.slice(4)}`;
  return `${bankAccount.slice(0, 3)}-${bankAccount.slice(3, 4)}-${bankAccount.slice(4, 9)}-${bankAccount.slice(9, 10)}`;
}

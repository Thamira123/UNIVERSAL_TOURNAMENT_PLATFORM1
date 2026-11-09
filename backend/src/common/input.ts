import { BadRequestException } from "@nestjs/common";

export function inputObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

export function textField(body: Record<string, unknown>, key: string, maxLength = 120): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new BadRequestException(`${key} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

export function optionalText(body: Record<string, unknown>, key: string, maxLength = 500): string {
  const value = body[key];
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new BadRequestException(`${key} must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

export function positiveInteger(body: Record<string, unknown>, key: string, fallback?: number): number {
  const value = body[key] ?? fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new BadRequestException(`${key} must be a whole number between 1 and 1000.`);
  }
  return parsed;
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

import { z } from "zod";
import { publicUserSchema } from "./common";

const usernameRegex = /^[a-z0-9_]+$/;
const accessKeyRegex = /^LBY-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(usernameRegex, "Only lowercase letters, numbers and underscores are allowed");

export const displayNameSchema = z.string().trim().min(2).max(40);

export const passwordSchema = z.string().min(12).max(128);

export const accessKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(accessKeyRegex, "Invalid access key format");

export const loginSchema = z.object({
  login: z.string().trim().min(3).max(254),
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: usernameSchema.transform((value) => value.toLowerCase()),
  email: z.string().trim().toLowerCase().email(),
  displayName: displayNameSchema,
  password: passwordSchema,
  accessKey: accessKeySchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const authSessionResponseSchema = z.object({
  user: publicUserSchema,
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const logoutResponseSchema = z.object({
  ok: z.literal(true),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export const authMessageResponseSchema = z.object({
  ok: z.literal(true),
});

export type AuthMessageResponse = z.infer<typeof authMessageResponseSchema>;

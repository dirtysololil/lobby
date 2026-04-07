import { z } from "zod";
import { publicUserSchema } from "./common";

const usernameRegex = /^[a-z0-9_-]+$/;
const accessKeyRegex = /^LBY-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Логин должен содержать минимум 3 символа")
  .max(24, "Логин должен содержать не больше 24 символов")
  .regex(
    usernameRegex,
    "Логин может содержать только строчные латинские буквы, цифры, символы _ и -",
  );

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Отображаемое имя должно содержать минимум 2 символа")
  .max(40, "Отображаемое имя должно содержать не больше 40 символов");

export const passwordSchema = z
  .string()
  .min(8, "Пароль должен содержать минимум 8 символов")
  .max(128, "Пароль должен содержать не больше 128 символов");

export const accessKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    accessKeyRegex,
    "Укажите корректный ключ доступа формата LBY-XXXXXXXX-XXXXXXXX-XXXXXXXX",
  );

export const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .min(3, "Введите логин или почту")
    .max(254, "Логин или почта слишком длинные"),
  password: z
    .string()
    .min(1, "Введите пароль")
    .max(128, "Пароль должен содержать не больше 128 символов"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: usernameSchema.transform((value) => value.toLowerCase()),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Введите корректный адрес электронной почты"),
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

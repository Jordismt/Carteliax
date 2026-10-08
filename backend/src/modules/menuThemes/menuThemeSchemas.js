import { z } from "zod";

export const DEFAULT_THEME = {
  template: "modern",

  colors: {
    primary: "#16a34a",
    secondary: "#f0fdf4",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    muted: "#64748b",
  },

  typography: {
    heading: "Inter",
    body: "Inter",
  },

  layout: {
    productStyle: "cards",
    borderRadius: 16,
    showImages: true,
    showDescriptions: true,
    showAllergens: true,
  },

  branding: {
    coverUrl: null,
    welcomeText: "",
  },
};

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "El color debe tener formato hexadecimal.");

const imageUrl = z.union([z.url().max(2048), z.null()]);

export const menuThemeSchema = z.strictObject({
  template: z.enum(["modern", "minimal", "premium", "mediterranean"]),

  colors: z.strictObject({
    primary: hexColor,
    secondary: hexColor,
    background: hexColor,
    surface: hexColor,
    text: hexColor,
    muted: hexColor,
  }),

  typography: z.strictObject({
    heading: z.enum(["Inter", "Poppins", "Montserrat", "Playfair Display", "Lora"]),

    body: z.enum(["Inter", "Poppins", "Montserrat", "Lora"]),
  }),

  layout: z.strictObject({
    productStyle: z.enum(["cards", "list", "compact"]),

    borderRadius: z.number().int().min(0).max(32),

    showImages: z.boolean(),
    showDescriptions: z.boolean(),
    showAllergens: z.boolean(),
  }),

  branding: z.strictObject({
    coverUrl: imageUrl,
    welcomeText: z.string().trim().max(250),
  }),
});

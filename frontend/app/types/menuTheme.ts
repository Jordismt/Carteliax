export type MenuTemplate = "modern" | "minimal" | "premium" | "mediterranean";

export type MenuFont = "Inter" | "Poppins" | "Montserrat" | "Playfair Display" | "Lora";

export type ProductStyle = "cards" | "list" | "compact";

export interface MenuTheme {
  template: MenuTemplate;

  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };

  typography: {
    heading: MenuFont;
    body: Exclude<MenuFont, "Playfair Display">;
  };

  layout: {
    productStyle: ProductStyle;
    borderRadius: number;
    showImages: boolean;
    showDescriptions: boolean;
    showAllergens: boolean;
  };

  branding: {
    coverUrl: string | null;
    welcomeText: string;
  };
}

export interface MenuThemeRecord {
  id?: string;
  menu_id: string;
  draft_config: MenuTheme;
  published_config: MenuTheme | Record<string, never>;
  updated_at: string | null;
  published_at: string | null;
}

export interface MenuThemeResponse {
  success: boolean;
  message?: string;
  theme: MenuThemeRecord;
}

export interface PreviewProduct {
  is_available?: boolean;
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  allergens: string[];
  allergen_codes?: string[];
}

export interface PreviewCategory {
  id: string;
  name: string;
  products: PreviewProduct[];
}

export const DEFAULT_MENU_THEME: MenuTheme = {
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

export const MENU_PRESETS: Record<MenuTemplate, MenuTheme> = {
  modern: {
    ...DEFAULT_MENU_THEME,
  },

  minimal: {
    template: "minimal",

    colors: {
      primary: "#292524",
      secondary: "#f5f5f4",
      background: "#ffffff",
      surface: "#fafaf9",
      text: "#1c1917",
      muted: "#78716c",
    },

    typography: {
      heading: "Inter",
      body: "Inter",
    },

    layout: {
      productStyle: "list",
      borderRadius: 4,
      showImages: true,
      showDescriptions: true,
      showAllergens: true,
    },

    branding: {
      coverUrl: null,
      welcomeText: "",
    },
  },

  premium: {
    template: "premium",

    colors: {
      primary: "#d4af37",
      secondary: "#292524",
      background: "#171717",
      surface: "#262626",
      text: "#fafaf9",
      muted: "#a8a29e",
    },

    typography: {
      heading: "Playfair Display",
      body: "Inter",
    },

    layout: {
      productStyle: "cards",
      borderRadius: 8,
      showImages: true,
      showDescriptions: true,
      showAllergens: true,
    },

    branding: {
      coverUrl: null,
      welcomeText: "",
    },
  },

  mediterranean: {
    template: "mediterranean",

    colors: {
      primary: "#b45309",
      secondary: "#fef3c7",
      background: "#fffbeb",
      surface: "#ffffff",
      text: "#44403c",
      muted: "#78716c",
    },

    typography: {
      heading: "Lora",
      body: "Inter",
    },

    layout: {
      productStyle: "cards",
      borderRadius: 20,
      showImages: true,
      showDescriptions: true,
      showAllergens: true,
    },

    branding: {
      coverUrl: null,
      welcomeText: "",
    },
  },
};

export function cloneTheme(theme: MenuTheme): MenuTheme {
  return JSON.parse(JSON.stringify(theme)) as MenuTheme;
}

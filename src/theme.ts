import { createTheme, MantineColorsTuple } from "@mantine/core";

// Penguin AI-style tokens (penguinai.co) (pink #fe017d, deep teal #05526d, cream #f9f7f2).
const brand: MantineColorsTuple = ["#fff0f7", "#ffd9ec", "#ffb3d9", "#ff80bf", "#ff4da6", "#ff1a8d", "#fe017d", "#d6016a", "#a80154", "#7a013d"];
const deep: MantineColorsTuple = ["#e6f2f5", "#c1dddf", "#9ccbd0", "#76b3b8", "#4f98a2", "#2d7a8a", "#05526d", "#044259", "#033245", "#022331"];

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 6,
  colors: { brand, deep },
  // penguinai.co body text is Outfit 400 at 14px / 1.625; headings are Outfit 800 at line-height 1.05.
  // Heading sizes are a compact app scale (40/28/20) that keeps the site's proportions; the site's 72px/60px hero sizes do not belong on a data screen.
  fontFamily: "var(--font-outfit), sans-serif",
  lineHeights: { xs: "1.625", sm: "1.625", md: "1.625", lg: "1.5", xl: "1.5" },
  headings: {
    fontFamily: "var(--font-outfit), sans-serif",
    fontWeight: "800",
    sizes: {
      h1: { fontSize: "40px", lineHeight: "1.05", fontWeight: "800" },
      h2: { fontSize: "28px", lineHeight: "1.1", fontWeight: "800" },
      h3: { fontSize: "20px", lineHeight: "1.2", fontWeight: "700" },
      h4: { fontSize: "18px", lineHeight: "1.25", fontWeight: "700" },
      h5: { fontSize: "16px", lineHeight: "1.3", fontWeight: "700" },
      h6: { fontSize: "14px", lineHeight: "1.3", fontWeight: "700" },
    },
  },
  defaultRadius: "md",
  black: "#1a1a1a",
  components: {
    Title: { styles: { root: { color: "var(--mantine-color-black)" } } },
    Badge: { styles: { root: { fontFamily: "var(--font-public-sans), sans-serif" } } },
    Card: { defaultProps: { withBorder: true, radius: "lg", shadow: "xs" } },
    Button: { styles: { root: { fontFamily: "var(--font-outfit), sans-serif", fontWeight: 600 } } },
    Tabs: { styles: { tabLabel: { fontFamily: "var(--font-outfit), sans-serif", fontWeight: 500, fontSize: 15 } } },
  },
});

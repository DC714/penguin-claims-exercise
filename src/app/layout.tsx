import "@mantine/core/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Outfit, Public_Sans } from "next/font/google";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { theme } from "@/theme";
import { Shell } from "@/components/Shell";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-outfit" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-public-sans" });

export const metadata: Metadata = {
  title: "Northgate Coding Assist",
  description: "Pilot review build: suggested codes, denial risks and warnings for clinic visit notes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${publicSans.variable}`} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript forceColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} forceColorScheme="light">
          <Shell>{children}</Shell>
        </MantineProvider>
      </body>
    </html>
  );
}

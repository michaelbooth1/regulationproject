import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description =
  "Playful charts and games built from The Regulation Podcast transcript archive.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Regulation Stats",
    description,
    openGraph: {
      title: "Who Owns the Mic? | Regulation Stats",
      description,
      type: "website",
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1536,
          height: 1024,
          alt: "Who Owns the Mic? Regulation Stats speaker-time chart",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Who Owns the Mic? | Regulation Stats",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

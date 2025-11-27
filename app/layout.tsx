import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"

const inter = Inter({ subsets: ["latin"] });

// ★ここを Vidnitive に更新しました
export const metadata: Metadata = {
  title: {
    default: "Vidnitive - 動画とAIで学ぶ多言語学習プラットフォーム",
    template: "%s | Vidnitive",
  },
  description: "YouTube動画からAIが自動で字幕・単語帳・教科書を生成。英語、スペイン語、中国語など10ヶ国語以上に対応した、次世代の語学学習プラットフォーム。",
  keywords: ["英語学習", "多言語", "AI", "YouTube", "語学", "プログラミング学習", "Vidnitive", "ヴィドニティブ"],
  authors: [{ name: "Information Student" }],
  creator: "Information Student",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://vercel.com/nakis-projects-d1ae2531/my-language-dojo-l8cl", // ※ドメイン取得後に修正してください
    title: "Vidnitive - Master Languages with AI & Video",
    description: "動画で学ぶ、AIが支える。ネイティブの感覚を掴む新しい学習体験。",
    siteName: "Vidnitive",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vidnitive - AI Video Learning",
    description: "動画 × AI × 多言語。最強の学習ツール。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}



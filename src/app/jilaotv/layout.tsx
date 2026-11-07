import type { Metadata, Viewport } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "机佬TV - 私人影视聚合平台",
  description:
    "机佬TV - 打造你的私人Netflix！聚合30+影视站点，提供智能搜索、实时测速、全网资源聚合。支持电影、电视剧、动漫、综艺等海量内容，极速播放体验。",
  keywords: "机佬TV,影视搜索,在线观看,电影,电视剧,动漫,综艺",
  authors: [{ name: "机佬TV" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f0f0f",
};

export default function JilaotvLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

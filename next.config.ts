// next.config.mjs
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  output: process.env.IS_MOBILE_BUILD ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
};

const withMDX = createMDX({})

// MDXの設定とNext.jsの設定を合体させる
export default withMDX(nextConfig)

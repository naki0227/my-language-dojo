// next.config.mjs
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Markdownファイルなどをページとして扱う設定
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
}

const withMDX = createMDX({})

// MDXの設定とNext.jsの設定を合体させる
export default withMDX(nextConfig)

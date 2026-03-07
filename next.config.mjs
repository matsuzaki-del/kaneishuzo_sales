/** @type {import('next').NextConfig} */
const nextConfig = {
    // Vercel デプロイでは、特別な理由がない限り standalone は不要な場合があるため、
    // 404 解消のために一旦解除して標準ビルドに戻します。
    /* output: 'standalone', */
};

export default nextConfig;

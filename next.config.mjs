/** @type {import('next').NextConfig} */
const nextConfig = {
	serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
	webpack: (config, { isServer }) => {
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				path: false,
				crypto: false,
			};
		}
		return config;
	},
	async headers() {
			return [
				{
					source: '/:path*',
					headers: [
						{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
						{ key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
						{ key: 'Cross-Origin-Resource-Policy', value: 'same-site' }
					]
				},
				{
					// Explicitly mark static assets as CORP to satisfy COEP
					source: '/_next/static/:path*',
					headers: [
						{ key: 'Cross-Origin-Resource-Policy', value: 'same-site' }
					]
				},
				{
					source: '/public/:path*',
					headers: [
						{ key: 'Cross-Origin-Resource-Policy', value: 'same-site' }
					]
				}
			];
	}
};

export default nextConfig;

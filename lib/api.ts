export const getApiBaseUrl = () => {
    // In mobile build, always use absolute URL
    // Note: process.env.IS_MOBILE_BUILD is set at build time
    if (process.env.IS_MOBILE_BUILD) {
        return 'https://enludus.vercel.app';
    }

    // In development, use relative path (proxy handles it)
    if (process.env.NODE_ENV === 'development') {
        return '';
    }

    // In production (Vercel), use relative path or absolute if needed
    return process.env.NEXT_PUBLIC_API_URL || 'https://enludus.vercel.app';
};

export const getApiUrl = (path: string) => {
    const baseUrl = getApiBaseUrl();
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
};

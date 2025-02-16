const isProd = import.meta.env.PROD;
const BASE_URL = isProd ? '/wake-up-for-suhoor-v1' : '';

export const getAssetPath = (path: string) => {
    // Remove leading slash if it exists
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${BASE_URL}/${cleanPath}`;
}; 
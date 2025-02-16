const isProd = import.meta.env.PROD;
const BASE_URL = isProd ? '/wake-up-for-suhoor-v1' : '';

export const getAssetPath = (path: string) => `${BASE_URL}${path}`; 
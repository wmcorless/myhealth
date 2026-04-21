// iFit developer credentials — register at https://www.ifit.com/developers
// Add these to a .env file and load via expo-constants or replace inline for dev
export const IFIT_CLIENT_ID = process.env.EXPO_PUBLIC_IFIT_CLIENT_ID ?? '';
export const IFIT_CLIENT_SECRET = process.env.EXPO_PUBLIC_IFIT_CLIENT_SECRET ?? '';
export const IFIT_REDIRECT_URI = 'myhealth://ifit-callback';
export const IFIT_API_BASE = 'https://api.ifit.com/v1';
export const IFIT_AUTH_URL = 'https://www.ifit.com/oauth2/authorize';
export const IFIT_TOKEN_URL = 'https://www.ifit.com/api/v1/oauth2/token';

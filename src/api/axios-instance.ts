import axios from 'axios';

// All SPA calls to the app's own /api go through this instance (template convention).
// Booking creates three calendar events and can take several seconds.
export const api = axios.create({ baseURL: '/', timeout: 45_000 });
export { isAxiosError } from 'axios';

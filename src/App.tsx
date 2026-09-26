import { SchedulePage } from './pages/SchedulePage';

// Single public route: /schedule?case=…&token=… (anything else renders the invalid-link state).
export function App() {
  const { pathname, search } = window.location;
  return <SchedulePage search={pathname.replace(/\/+$/, '') === '/schedule' ? search : ''} />;
}

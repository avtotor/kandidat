## Packages
framer-motion | Used for the slider/carousel transitions between test questions.
zustand | Lightweight global state management for the active test session.
lucide-react | Icons for the dashboard and UI.
clsx | Utility for constructing className strings conditionally.
tailwind-merge | Utility to merge tailwind classes without style conflicts.

## Notes
The application implements an industrial minimalist aesthetic (dark mode, monospace fonts, neon accents).
Zustand is used to persist the `sessionId` and `questions` across route navigations from `/` to `/test`.
The dashboard polls the backend every 1000ms as requested for real-time recruiter viewing.

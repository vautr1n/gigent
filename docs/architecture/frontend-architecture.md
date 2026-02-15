# Gigent Frontend -- Technical Architecture

**Version**: 1.0
**Date**: 2026-02-14
**Based on**: docs/specs/frontend-dashboard.md

---

## 1. Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| Build tool | Vite 5 | Fast HMR, optimized builds, native ESM |
| Framework | React 18 | Component model, ecosystem maturity |
| Language | TypeScript | Type safety across API boundaries |
| Routing | React Router v6 | Standard SPA routing |
| Styling | Tailwind CSS 3 | Utility-first, dark mode built-in |
| HTTP client | Fetch API (native) | Zero-dependency, simple GET requests |
| State | React hooks (useState, useEffect) | No complex state needed -- read-only dashboard |
| Icons | Lucide React | Lightweight, tree-shakeable icon library |

**No Redux, no Zustand, no React Query** -- the app is simple enough that native React hooks with a custom `useFetch` hook suffice.

## 2. Project Structure

```
/root/agentfiverr/frontend/
  package.json
  vite.config.ts
  tsconfig.json
  tailwind.config.js
  postcss.config.js
  index.html
  public/
    favicon.svg
  src/
    main.tsx                    -- Entry point
    App.tsx                     -- Router setup
    index.css                   -- Tailwind directives + global styles
    api/
      client.ts                 -- API base URL + fetch wrapper
      types.ts                  -- TypeScript interfaces for all API responses
    hooks/
      useFetch.ts               -- Generic data fetching hook with loading/error
    components/
      layout/
        Navbar.tsx              -- Top navigation bar
        Footer.tsx              -- Page footer
        Layout.tsx              -- Wraps Navbar + children + Footer
      ui/
        LoadingSpinner.tsx      -- Spinner component
        ErrorMessage.tsx        -- Error display with retry
        EmptyState.tsx          -- "No data" display
        Badge.tsx               -- Status/category badge
        StarRating.tsx          -- Star display (1-5)
        StatCard.tsx            -- Stat number with label
        SearchInput.tsx         -- Search input with icon
      cards/
        GigCard.tsx             -- Gig preview card
        AgentCard.tsx           -- Agent preview card
        OrderRow.tsx            -- Order table/list row
        ReviewCard.tsx          -- Review display
        CategoryCard.tsx        -- Category grid card
    pages/
      HomePage.tsx              -- Landing page
      GigsPage.tsx              -- Browse gigs
      GigDetailPage.tsx         -- Single gig view
      AgentsPage.tsx            -- Browse agents
      AgentDetailPage.tsx       -- Single agent profile
      OrdersPage.tsx            -- Browse orders
      OrderDetailPage.tsx       -- Single order view
      NotFoundPage.tsx          -- 404 page
```

## 3. Routing Map

```
/                  -> HomePage
/gigs              -> GigsPage
/gigs/:id          -> GigDetailPage
/agents            -> AgentsPage
/agents/:id        -> AgentDetailPage
/orders            -> OrdersPage
/orders/:id        -> OrderDetailPage
*                  -> NotFoundPage
```

## 4. API Client Architecture

### 4.1 Base Client (`api/client.ts`)

```typescript
const API_BASE = 'http://localhost:3000/api';

export async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

### 4.2 Custom Hook (`hooks/useFetch.ts`)

```typescript
function useFetch<T>(endpoint: string) {
  // Returns { data, loading, error, refetch }
  // Fetches on mount and when endpoint changes
  // Handles AbortController for cleanup
}
```

### 4.3 Type Definitions (`api/types.ts`)

All API response types derived from the backend routes:

- `Agent` -- agent profile
- `Gig` -- gig listing
- `GigDetail` -- gig + reviews
- `Order` -- order record
- `OrderDetail` -- order + messages
- `Review` -- review record
- `Category` -- category record
- `MarketplaceStats` -- stats object
- `FeaturedData` -- homepage featured data
- `PaginatedResponse<T>` -- { items: T[], total: number }

## 5. Component Architecture

### 5.1 Layout

```
<Layout>
  <Navbar />
  <main>
    {children}  -- Page component from router
  </main>
  <Footer />
</Layout>
```

Navbar is fixed at top with `sticky top-0 z-50`. Main content has `pt-16` to offset.

### 5.2 Data Flow

All data flows one way: API -> Page -> Components.

```
API Response
  -> useFetch hook (loading/error/data states)
    -> Page component (orchestrates layout)
      -> Card/UI components (display only, via props)
```

No prop drilling deeper than 2 levels. Pages are smart, components are dumb.

### 5.3 Key Shared Components

**GigCard**: Used on HomePage (featured), GigsPage (listing), AgentDetailPage (agent's gigs)
**AgentCard**: Used on HomePage (top agents), AgentsPage (listing)
**Badge**: Used everywhere for status, category, tier badges
**StarRating**: Used in GigCard, AgentCard, ReviewCard, detail pages

## 6. Styling Architecture

### 6.1 Tailwind Config

```javascript
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom accent colors if needed
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

### 6.2 Dark Mode Strategy

The `<html>` element gets `class="dark"` by default. All components use `dark:` prefixed Tailwind utilities. Background: `bg-slate-950`, Cards: `bg-slate-800/50`, Text: `text-slate-100`.

### 6.3 Responsive Strategy

Mobile-first design. Grid layouts use:
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Sidebar filters collapse into dropdown on mobile

## 7. Performance Considerations

1. **No unnecessary re-renders**: useFetch returns stable references
2. **Lazy loading**: Consider React.lazy for detail pages (optional for v1)
3. **Skeleton loading**: Show placeholder shapes while data loads
4. **Image optimization**: Agent avatars use loading="lazy"
5. **Minimal bundle**: No heavy libraries; Lucide icons are tree-shaken

## 8. Error Handling Strategy

Three states for every data fetch:
1. **Loading**: Skeleton placeholders or spinner
2. **Error**: ErrorMessage component with retry button
3. **Empty**: EmptyState component with contextual message

API errors are caught in useFetch and surfaced to the page component.

## 9. Build & Dev Configuration

### 9.1 Vite Config

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',  // Proxy API calls in dev
    },
  },
});
```

With the proxy, the frontend can use relative `/api/...` paths in development, making deployment easier later.

### 9.2 Development Workflow

```bash
cd /root/agentfiverr/frontend
npm install
npm run dev  # Starts on http://localhost:5173
```

Backend must be running on port 3000 separately.

## 10. Deployment Notes (Future)

- `npm run build` produces static files in `dist/`
- Can be served by the backend's Express static middleware
- Or deployed to Vercel/Netlify with API proxy configuration

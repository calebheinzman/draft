# Project Instructions

## Project overview

All-In Draft Order is a static browser-based card game. It uses plain HTML, CSS, and JavaScript with no build step.

## Key files

- `index.html`: Page structure and script loading order.
- `styles.css`: Layout, visual design, responsive behavior, and animation.
- `index.js`: Application startup, top-level event wiring, and module coordination.
- `game.js`: Draft state, game rules, and domain behavior.
- `sleeper.js`: Sleeper API requests and response normalization.
- `package.json`: Local development commands.

## Local development

Run the development server from the repository root:

```sh
npm run dev
```

`npm run live` is the equivalent direct command. Both start Live Server on port 3000, open `index.html`, and watch the project for changes.

There is no compilation or production build step.

## Project organization

- Keep each file focused on one responsibility. Split a file when unrelated behavior starts accumulating or its public API becomes difficult to describe briefly.
- Organize new user-facing behavior by feature. A feature should own its state, actions, and feature-specific UI coordination.
- Put reusable, presentation-focused UI in `components/`. Components should receive the data and callbacks they need instead of fetching data or reaching into unrelated feature state.
- Put small, broadly reusable, side-effect-free helpers in `utils/`. A helper used by only one feature should stay with that feature until it is genuinely shared.
- Keep external API calls and response normalization in service or integration files. Sleeper-specific requests belong in `sleeper.js` rather than UI or game-rule code.
- Keep draft and game rules in `game.js`. Rules should be expressible without depending on DOM elements whenever practical.
- Keep application startup and coordination between modules in `index.js`. Avoid placing detailed feature logic there.
- Keep visual rules in `styles.css`; avoid inline styles and inline event handlers in HTML.

As the project grows, prefer this shape:

```text
features/       Feature state, actions, and feature-specific views
components/     Reusable UI components
utils/          Generic pure helpers
services/       External APIs, persistence, and data normalization
```

Do not create a new abstraction or directory for a single trivial function. Introduce structure when it creates a clear ownership boundary.

## Separation of concerns

- Separate data access, domain rules, state updates, and DOM rendering. Normalize network responses before game logic or UI consumes them.
- Prefer explicit inputs and return values over shared mutable globals. Keep state ownership clear and update state through a small set of named functions.
- Keep DOM queries and event listeners close to the UI code that owns them. Cache stable element references instead of repeatedly querying the document.
- Render from state instead of using the DOM as application state. After an action, update state first and then update the affected view.
- Keep feature modules independent. Share data through public functions rather than reaching into another feature's internal variables or elements.
- Keep utilities pure when possible: no DOM access, network calls, storage access, or mutation of caller-owned values.
- Handle loading, empty, success, and error states at the boundary that performs asynchronous work.

## Features and components

- Give each feature one clear entry point and a small public API. Keep implementation details private to the feature.
- Create reusable components only when they represent the same concept in more than one place; avoid premature generic components.
- Pass component dependencies explicitly as arguments or options. Do not make reusable components depend on page-specific selectors.
- Use semantic HTML and preserve keyboard access when adding interactive controls. Buttons should be real `button` elements and form controls should have labels.
- Prefer targeted DOM updates over rebuilding the entire page for a small state change.
- Keep CSS class names stable and descriptive. Prefer explicit `data-*` JavaScript hooks when styling classes would create accidental coupling.

## Coding conventions

- Match the existing JavaScript and CSS style in the surrounding file.
- Use descriptive names based on intent and keep functions focused on one clear purpose.
- Use constants for repeated selectors, event names, storage keys, and configuration values.
- Validate data received from APIs or storage before using it. Do not assume optional fields are present.
- Keep cache-busting query values on related CSS and script URLs consistent, and change them only when an asset update needs to bypass browser cache.
- Avoid adding dependencies when the browser platform or a small local helper is sufficient.
- Remove dead code, temporary logging, and commented-out implementations before finishing a change.

## Change guidelines for agents

- Make the smallest coherent change that satisfies the request; avoid unrelated refactors.
- Preserve existing behavior and public function contracts unless the task explicitly requires a breaking change.
- Check all callers before renaming or moving shared functions, selectors, IDs, or CSS classes.
- Keep feature work and broad cleanup separate so changes remain easy to review and revert.
- Update this file when a new architectural boundary or project-wide convention is introduced.
- Document any new setup command, environment variable, or required manual step alongside the change.

## Useful checks

- Start the app with `npm run dev` and confirm it opens at `http://localhost:3000`.
- Check the browser console for errors after changing JavaScript or API behavior.
- Check both desktop and mobile layouts after changing HTML or CSS.
- Exercise loading, empty, success, and failure paths after changing Sleeper integration behavior.

# Customer Journey Insights

Customer Journey Insights is a self-hosted form tracking and analytics layer for AEM Forms. It captures how users move through a form, where they stop, and which errors or service failures affect completion.

The project has three main parts:

- A browser tracker that records form interactions and journey state.
- A local analytics server that stores sessions, screenshots, errors, fixes, cycles, and generated insights.
- A dashboard that shows journeys, drop-offs, submission failures, screenshots, and AI-assisted summaries.

## What It Tracks

The tracker records important user and form events, including:

- Form started
- Field focus and field interaction
- Button clicks
- Dead clicks, disabled clicks, and rage clicks
- Step changes
- Abandoned journeys
- Returned journeys
- Successful submissions
- Submission failures
- Service errors and API errors
- JavaScript and console errors

Each journey is grouped by a generated journey ID so multiple page loads or continuation steps can be connected into the same customer flow.

## Screenshots

Screenshots are captured only for events where visual context is useful, such as:

- Abandonment
- Submission failure
- Service error screens
- Dead click or disabled click context

For final submission failures, the dashboard focuses on the final error screen. For errors where the user is moved to a different error page, the dashboard can show both the screen before the error and the error screen.

Sensitive values in screenshots are masked before storing or displaying when masking is needed. Labels can remain visible so the screen still explains what happened, while values such as reference numbers, loan amounts, selected bank details, or user-entered data are hidden.

## Success, Failure, and Abandonment

A journey should be marked as successful only when the form reaches a real successful submission state. If the final screen says the request could not be submitted, application number was not generated, or another final failure message appears, the journey should be classified as a submission failure instead of success.

An abandoned journey is recorded when the user stops before a successful or failed completion. If the user returns and continues, the journey can continue under the same journey ID instead of creating a completely separate story.

## Running Locally

Start the analytics server:

```bash
npm run server
```

Open the dashboard:

```text
http://localhost:3000/analytics/
```

The tracker sends events to:

```text
http://localhost:3000/events
```

For browser or extension testing, make sure the tracker is injected on every page that belongs to the customer journey. This matters for multi-page flows, redirects, eKYC, Perfios, or other external steps.

## Manual Testing Checklist

Before testing manually:

- Start the analytics server.
- Confirm the extension or script is active on the form page.
- Confirm the tracker server URL points to the correct server.
- Keep the same browser tab during a full journey when possible.
- If the extension settings change, reload the target form page.

While testing:

- Fill the form normally.
- Try abandon flow by stopping midway and checking the dashboard.
- Try return flow by coming back to the same journey.
- Try submit success only when the final screen is truly successful.
- Try submit failure and confirm the final error screen is shown.
- Check that sensitive screenshot values are masked when required.

## Different Form Flows

Different forms can have different submission and redirect behavior. Some forms complete on the same page, some show a thank-you screen, some show a failure screen, and some move through external systems like eKYC or Perfios.

The tracker is designed to handle common flows generically, but final success and failure classification may need form-specific detection rules when a form uses unique final screens or custom backend responses.

## Important Files

- `fis-page-tracker.js` - page-level tracker used for injected tracking flows.
- `fis-tracker.js` - tracker bundle/script variant.
- `blocks/form-tracker/form-tracker.js` - tracker integration for forms rendered by this repo.
- `chrome-extension/tracker-content.js` - extension content script.
- `server/server.js` - local analytics server and API routes.
- `server/store.js` - persistence and journey/session storage handling.
- `server/analyzer.js` - event classification and issue analysis.
- `server/insights.js` - generated insights logic.
- `analytics/analytics.js` - dashboard UI behavior.

## Known Limitations

- Cross-origin flows need tracker coverage on each allowed host or page.
- Final submission success/failure can vary by form, so unusual final screens may require additional classification rules.
- Screenshots should be captured only when useful, because they consume storage.
- Sensitive values in screenshots must be masked before sharing or demoing real customer-like data.

## Demo Summary

Customer Journey Insights helps teams understand where users struggle in forms. Instead of only seeing that a user dropped off, the dashboard shows the journey timeline, the last meaningful action, error classification, and visual context. This makes it easier to debug form UX issues, backend service failures, and submission problems.

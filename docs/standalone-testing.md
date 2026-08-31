# Standalone APK test guide

## What the APK needs

- An Android phone with internet access.
- No PC, local server, Wi-Fi address, pairing token, Groq account, or manually entered API key.
- Health Connect requires the installable APK (not Expo Go) and Android support for Health Connect.

## First test pass

1. Install the preview APK and complete onboarding with realistic body, activity, cuisine, and goal details.
2. Confirm the starting meal structure appears in **Goals** and that its calorie/protein targets match onboarding values.
3. In **Food**, type: `two whole wheat rotis with one plate mash ki dal at 1 PM`. Review the proposed items, then confirm. Check that both foods appear at 1 PM.
4. Repeat by voice. Raw audio must not be retained; only the returned transcript is used.
5. Ask the AI to add a one-off modifier such as `I had aloo keema with one extra tablespoon of oil`. Confirm that oil is a separate diary item rather than a changed saved recipe.
6. Ask it to correct an entry time, delete an entry, and log today’s weight. Confirm it asks before applying each change and that only one weight remains for the day.
7. In **You → Connections**, confirm Voice assistant and Food agent show ready without a PC-link form. Health Connect can be connected separately.
8. In **You → Backup & restore**, share a backup, then verify no raw audio or credentials appear in it.

## APK feedback regression pass

1. In **Today**, check that all seven visible days run Monday through Sunday. Press an arrow: the entire strip must move exactly one week. Press the week label to return to today.
2. Log a boiled egg. Tap its diary row, change the date, time, amount, and note, then save. The item must move to the selected day/time without changing the reusable egg reference.
3. In **Food**, search `boiled egg` and `whole wheat roti` with internet available and then after temporarily disabling data. Saved/reference matches and **Custom food** / **Build a dish** must remain usable either way.
4. In **You → Goals & daily plan**, open **How the plan updates**. Verify the normal view is compact and that it says it needs 10 food-log days plus a 14-day weight span before a bounded weekly automatic adjustment.
5. In **You → Date & time**, leave **Device time** selected (or choose Pakistan UTC+5), then log food around local midnight. It must use the visible local calendar day.
6. In **You → Appearance**, select another palette. The app may restart once, then must reopen in the selected palette.
7. In **You → Connections → Connect Health**, the Android Health Connect permission screen or a clear result dialog must appear. If it says Health Connect is unavailable, first confirm the phone supports it, it is installed/up to date, and the phone has a screen lock.

## Free-service behavior

The app uses the Groq Free plan. If the AI is temporarily rate-limited, local logging, cookbook edits, trends, and backup remain usable. Wait for the displayed retry period before sending another AI request.

The Worker’s access token is for the owner’s private test APK only and can be rotated on the next build. It is not public-release authentication.

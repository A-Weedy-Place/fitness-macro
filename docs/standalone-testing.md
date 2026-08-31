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

## Free-service behavior

The app uses the Groq Free plan. If the AI is temporarily rate-limited, local logging, cookbook edits, trends, and backup remain usable. Wait for the displayed retry period before sending another AI request.

The Worker’s access token is for the owner’s private test APK only and can be rotated on the next build. It is not public-release authentication.

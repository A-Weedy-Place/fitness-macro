# Testing the mobile app

## Start the local PC agent

```powershell
Set-Location C:\Users\pc\Desktop\UwU\fitness\agent
npm run dev:env
```

The agent listens on port `8787`. Keep it on your private network; do not forward this port to the public internet.

## Start Expo

The current PC address is configured in `mobile/.env`. If the Wi-Fi network changes, find the new IPv4 address with `ipconfig` and update `EXPO_PUBLIC_AGENT_BASE_URL`, then run:

```powershell
Set-Location C:\Users\pc\Desktop\UwU\fitness\mobile
npm start -- --lan
```

Open the QR code in Expo Go. The phone and PC must be on the same network. If search fails but local logging works, check the PC firewall and the LAN address.

## First test session

1. Open `You` and save your body profile and desired weekly weight change.
2. Open `Food`, search for two foods, and add them to different meals.
3. Create one food from a packet label and add one serving.
4. Open `Today`, log weight, add an activity, and inspect daily totals.
5. Open `Plans`, save the day as a plan, move to another date, and apply it.
6. Add logs across several dates using the date switcher.
7. Open `Trends` and inspect 7-, 14-, and 30-day ranges.
8. Turn off the PC agent, add a food entry, confirm the sync count increases, restart the agent, and tap Sync.
9. Delete a food entry, weight log, activity, and plan; sync again.

## Automated checks

```powershell
Set-Location C:\Users\pc\Desktop\UwU\fitness\mobile
npm test
npm run typecheck
```

```powershell
Set-Location C:\Users\pc\Desktop\UwU\fitness\agent
npm test
npm run build
```

## Useful feedback

For each issue, note the tab, action, expected result, actual result, and whether the PC agent was online. Screenshots are especially useful for spacing, chart labels, keyboard overlap, and small-screen layout problems.

import { Redirect } from 'expo-router';

/**
 * Legacy `/feed` route — now a redirect into the Feed tab.
 *
 * This file used to render a second, standalone "Company" screen: a
 * company-wide photo grid grouped by day with a per-capture author avatar, plus
 * a "Projects" list that just repeated the Jobs tab. All of it now lives inside
 * the Feed tab — the company-wide view is its Gallery sub-tab on the "Company"
 * scope — so a parallel screen only bought two places to fix every bug, two
 * error banners to keep in step, and two answers to "where are my team's
 * photos?".
 *
 * Why the file survives instead of being deleted: `/feed` is addressable. The
 * web build ships static output, so it is a real URL someone can bookmark or
 * link, and on native it is a deep-link target. Nothing in the app navigates
 * here any more — the Feed tab's header button used to, and now switches
 * sub-tab in place instead of round-tripping through the router — so this route
 * exists solely for links that already point at it. It has to land somewhere
 * sensible rather than on expo-router's "Unmatched Route" screen, and a
 * redirect costs one file and cannot render a broken screen.
 *
 * There is deliberately no auth guard here. `app/(tabs)/_layout.tsx` already
 * holds signed-out users and sends them to /login, so this inherits that check
 * instead of duplicating one that can drift. Error banners, refresh control and
 * empty states are likewise the Feed tab's job now — this route owns no content
 * and therefore has no state of its own to get wrong.
 */
export default function LegacyFeedRoute() {
  // `view=company` is read by app/(tabs)/gallery.tsx, which selects the Gallery
  // sub-tab and its Company scope — the company-wide grid this URL used to
  // render. The param does real work: the Feed tab is usually already mounted,
  // and could be sitting on "Mine" or on another sub-tab when the link opens.
  return <Redirect href={{ pathname: '/(tabs)/gallery', params: { view: 'company' } }} />;
}

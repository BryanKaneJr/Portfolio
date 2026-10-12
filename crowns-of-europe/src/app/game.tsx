/**
 * The game screen: the map fills the screen, edge to edge; glass controls float over it (the top bar, the dock in
 * the thumb zone, the map lens, the outliner); sheets rise over the dock; cards and panels over everything.
 */
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { MapView } from '../ui/map/MapView';
import { BottomBar, Toasts, TopBar, WarRail } from '../ui/game/Bars';
import { SideRail } from '../ui/game/Outliner';
import { RegionSheet } from '../ui/game/RegionSheet';
import { ArmySheet, BattleSheet, FleetSheet, SeaSheet } from '../ui/game/UnitSheets';
import { NationSheet } from '../ui/game/NationSheet';
import { EventCard, GameOverCard, OfferCard, ReportCard } from '../ui/game/Cards';
import { BreakdownPanel, DeclareWarPanel, LogPanel } from '../ui/game/Panels';
import { WarPanel } from '../ui/game/WarScreen';
import { MenuPanel } from '../ui/game/Menu';
import { HelpPanel, Hints } from '../ui/game/Help';
import { store, useStore } from '../state/store';
import { saveGame } from '../state/storage';
import { C } from '../ui/theme';

export default function GameScreen() {
  const st = useStore();
  const s = st.state;

  // Save when the app goes to the background; stop the clock.
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active' && store.state) {
        store.setPaused(true);
        saveGame('auto', store.state).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  if (!s) return <Redirect href="/" />;

  const sel = st.selection;
  const ov = st.overlay;
  const unseen = s.unseenReports[0] ? s.reports.find(r => r.id === s.unseenReports[0]) : undefined;
  const reportOverlay = ov?.kind === 'report' ? s.reports.find(r => r.id === ov.id) : undefined;

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <MapView />
      </View>
      {/* Floating controls (hidden under a full-screen panel; sheets rest between them). */}
      {!ov ? (
        <>
          <TopBar />
          <WarRail />
          <SideRail />
          <BottomBar />
        </>
      ) : null}
      {/* Sheets sit above the rails, so one pulled to full height is not overlapped by their buttons. */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 26 }]} pointerEvents="box-none">
        {sel?.kind === 'region' ? <RegionSheet id={sel.id} /> : null}
        {sel?.kind === 'army' ? <ArmySheet id={sel.id} /> : null}
        {sel?.kind === 'fleet' ? <FleetSheet id={sel.id} /> : null}
        {sel?.kind === 'nation' ? <NationSheet id={sel.id} /> : null}
        {sel?.kind === 'sea' ? <SeaSheet id={sel.id} /> : null}
        {sel?.kind === 'battle' ? <BattleSheet id={sel.id} /> : null}
        <Hints sheet={!sel ? undefined : (sel.kind === 'army' && s.armies[sel.id]?.owner === s.player) || (sel.kind === 'fleet' && s.fleets[sel.id]?.owner === s.player) ? 'compact' : 'half'} />
      </View>
      <Toasts />

      <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]} pointerEvents="box-none">
      {ov?.kind === 'menu' ? <MenuPanel tab={ov.tab} /> : null}
      {ov?.kind === 'log' ? <LogPanel /> : null}
      {ov?.kind === 'peace' ? <WarPanel warId={ov.war} /> : null}
      {ov?.kind === 'declareWar' ? <DeclareWarPanel target={ov.target} /> : null}
      {ov?.kind === 'breakdown' ? <BreakdownPanel what={ov.what} /> : null}
      {ov?.kind === 'help' ? <HelpPanel /> : null}
      {reportOverlay ? (
        <ReportCard
          report={reportOverlay}
          onClose={() => {
            st.markReportSeen(reportOverlay.id);
            st.open({ kind: 'log' });
          }}
        />
      ) : null}

      {/* Cards that need an answer, one at a time: events, offers, then unseen battle results. */}
      {s.pendingEvents.length ? <EventCard /> : s.offers.length ? <OfferCard /> : unseen && !ov ? (
        <ReportCard
          report={unseen}
          onClose={() => st.markReportSeen(unseen.id)}
        />
      ) : null}
      {s.gameOver ? <GameOverCard /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.chrome },
});

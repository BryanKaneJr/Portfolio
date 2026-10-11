/** The game screen: top bar, map (75% of the screen), bottom bar in the thumb zone, sheets and cards on top. */
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapView } from '../ui/map/MapView';
import { BottomBar, MapModeChip, Toasts, TopBar, WarStrip } from '../ui/game/Bars';
import { RegionSheet } from '../ui/game/RegionSheet';
import { ArmySheet, BattleSheet, FleetSheet, SeaSheet } from '../ui/game/UnitSheets';
import { NationSheet } from '../ui/game/NationSheet';
import { EventCard, GameOverCard, OfferCard, ReportCard } from '../ui/game/Cards';
import { BreakdownPanel, DeclareWarPanel, LogPanel, PeacePanel } from '../ui/game/Panels';
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
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.chrome }}>
        <TopBar />
      </SafeAreaView>
      <View style={{ flex: 1 }}>
        <MapView />
        <WarStrip />
        <MapModeChip />
        {sel?.kind === 'region' ? <RegionSheet id={sel.id} /> : null}
        {sel?.kind === 'army' ? <ArmySheet id={sel.id} /> : null}
        {sel?.kind === 'fleet' ? <FleetSheet id={sel.id} /> : null}
        {sel?.kind === 'nation' ? <NationSheet id={sel.id} /> : null}
        {sel?.kind === 'sea' ? <SeaSheet id={sel.id} /> : null}
        {sel?.kind === 'battle' ? <BattleSheet id={sel.id} /> : null}
        {!sel ? <Hints /> : null}
        <Toasts />
      </View>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.chrome }}>
        <BottomBar />
      </SafeAreaView>

      {ov?.kind === 'menu' ? <MenuPanel tab={ov.tab} /> : null}
      {ov?.kind === 'log' ? <LogPanel /> : null}
      {ov?.kind === 'peace' ? <PeacePanel warId={ov.war} /> : null}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.chrome },
});

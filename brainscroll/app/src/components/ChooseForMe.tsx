import { chooseForMe, type Choice } from "@brainscroll/core";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { track } from "@/analytics/track";
import {
  Button,
  Caption,
  Card,
  Eyebrow,
  LevelArt,
  Reveal,
  Row,
  Title,
} from "@/components/ui";
import { getSkill, levelMeta } from "@/content";
import { useProgress, useProgressView } from "@/progress/ProgressProvider";
import { useCurrentSkill } from "@/progress/useCurrentSkill";
import { announce, feedback, useReduceMotion, useScreenReader } from "@/theme/feedback";
import { color, space } from "@/theme/tokens";

/**
 * "Choose for me" on the World Map, for when you don't know what to learn
 * next. It offers one skill (never the one you're on, usually one you haven't
 * started, from another subject) with its next level; "Pick again" moves on,
 * and Start drops you straight into that level. Rules: `chooseForMe` (core).
 *
 * The pick is decided the moment you tap; the reveal only presents it (roadmap
 * §14): a few skill names cycle and slow down, each with a light tick, then the
 * choice lands with a firmer one. Under a second, never casino-like, and it
 * skips straight to the landing with Reduce Motion or a screen reader. The
 * cycling names are hidden from screen readers (one "Choosing a skill for
 * you", never a burst of names); the landing is announced once.
 */

/** Gaps between names as the cycle slows (ms); about 0.9 s in all. */
const CYCLE = [70, 80, 95, 115, 140, 175, 220];
export function ChooseForMe({ onChoice }: { onChoice?: () => void }) {
  const p = useProgress();
  const v = useProgressView();
  const current = useCurrentSkill();
  const reduce = useReduceMotion();
  const screenReader = useScreenReader();
  const [spin, setSpin] = useState<{ names: string[]; i: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // A round of offers belongs to the current skill: once that changes (say,
  // after starting the pick), the next round starts fresh.
  const [round, setRound] = useState<{
    base?: string;
    offered: string[];
    choice?: Choice;
  }>({ offered: [] });
  const { offered, choice } =
    round.base === current?.id
      ? round
      : { offered: [] as string[], choice: undefined };

  const candidates = v.skills.map((s) => ({
    id: s.id,
    subjectId: s.subjectId,
    level: s.view.level,
    hasNext: !!p.nextLevelId(s.id),
  }));
  const pick = (seen: string[]) => {
    const c = chooseForMe(candidates, {
      currentSkillId: current?.id,
      offered: seen,
    });
    const finalName = c && v.skills.find((s) => s.id === c.skillId)?.name;
    const commit = () => {
      setRound({
        base: current?.id,
        offered: c ? [...seen, c.skillId] : seen,
        choice: c,
      });
      if (finalName) announce(`Chosen for you: ${finalName}`);
    };
    const others = v.skills.filter((s) => s.id !== c?.skillId).map((s) => s.name);
    if (!c || !finalName || reduce || screenReader || others.length === 0) {
      commit();
      if (c) feedback("chooseLand");
      return;
    }
    // A shuffled handful of other skills, ending on the real pick.
    const names = [...others].sort(() => Math.random() - 0.5).slice(0, CYCLE.length);
    while (names.length < CYCLE.length) names.push(others[names.length % others.length]);
    names.push(finalName);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSpin({ names, i: 0 });
    feedback("chooseTick");
    let at = 0;
    CYCLE.forEach((gap, k) => {
      at += gap;
      timers.current.push(
        setTimeout(() => {
          setSpin({ names, i: k + 1 });
          if (k + 1 < names.length - 1) feedback("chooseTick");
        }, at),
      );
    });
    timers.current.push(
      setTimeout(() => {
        setSpin(null);
        commit();
        feedback("chooseLand");
      }, at + 260),
    );
  };

  // Only when there's somewhere else to go and a new level can be started today.
  const available = chooseForMe(candidates, {
    currentSkillId: current?.id,
    random: () => 0,
  });
  if (v.today.dailyComplete || !available || available.skillId === current?.id)
    return null;

  if (spin)
    return (
      <Card style={{ gap: space.xs, alignItems: "center" }} accessibilityLabel="Choosing a skill for you">
        <Eyebrow tone="brand">Choosing for you</Eyebrow>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
          <Title
            style={{
              color: spin.i === spin.names.length - 1 ? color.brandText : color.textMuted,
            }}
          >
            {spin.names[spin.i]}
          </Title>
        </View>
      </Card>
    );

  if (!choice)
    return (
      <Button
        variant="success"
        label="Choose for me"
        onPress={() => pick([])}
      />
    );

  const skill = v.skills.find((s) => s.id === choice.skillId);
  const nextId = p.nextLevelId(choice.skillId);
  const next = nextId ? levelMeta(nextId) : undefined;
  if (!skill || !next) return null;
  const promise = getSkill(skill.id)?.masteryPromise;

  return (
    <Reveal key={skill.id}>
      <View
        onLayout={() => {
          // Once now and again after the reveal settles.
          setTimeout(() => onChoice?.(), 60);
          setTimeout(() => onChoice?.(), 400);
        }}
      >
        {/* No card label: it holds its own buttons, and its text reads in order. */}
        <Card style={{ gap: space.md }}>
          <Row gap={space.md}>
            <LevelArt art={next.art} size={64} />
            <View style={{ flex: 1, gap: space.xxs }}>
              <Eyebrow tone="brand">
                {choice.kind === "new"
                  ? "Chosen for you · new"
                  : `Chosen for you · back to Lv. ${skill.view.level}`}
              </Eyebrow>
              <Title>{skill.name}</Title>
              <Caption>
                Level {next.number}, {next.title}
              </Caption>
            </View>
          </Row>
          {promise && <Caption>At Lv. 100: {promise}</Caption>}
          <View style={{ gap: space.xs }}>
            <Button
              label={`Start Level ${next.number}`}
              onPress={() => {
                track("choose_for_me_started", {
                  skill_id: skill.id,
                  kind: choice.kind,
                  picks: offered.length,
                });
                p.setActiveSkill(skill.id);
                router.push({
                  pathname: "/level/[id]",
                  params: { id: next.id },
                });
              }}
            />
            <Button
              variant="ghost"
              label="Pick again"
              onPress={() => pick(offered)}
            />
          </View>
        </Card>
      </View>
    </Reveal>
  );
}

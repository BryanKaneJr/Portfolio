import { describe, expect, it } from 'vitest';
import { usernameBlocked, usernameParts } from '../src/usernameFilter';

describe('usernameBlocked', () => {
  it('lets ordinary and generated usernames through', () => {
    for (const ok of ['curious_otter_4821', 'maya_reads', 'grapefruit_fan', 'the_therapist', 'scunthorpe_utd', 'cocktail_hour', 'dickens_reader',
      'cucumber_cool', 'sussex_sam', 'class_act', 'bass_player', 'peacock_42', 'torpedo_ted', 'badminton_pro', 'analysis_nerd', 'uranus_fan',
      'document_dan', 'title_hunter', 'hitchhiker', 'nightingale', 'mississippi', 'assassins_creed', 'crisis_mode', 'supportive_pal'])
      expect(usernameBlocked(ok), ok).toBe(false);
  });

  it('refuses offensive terms, with the usual workarounds', () => {
    for (const bad of ['fuck', 'xfuckx', 'fuuuck_you', 'f_u_c_k', 'sh1t_head', 'b00bs', 'big_dick', 'dick69', 'nazi_boy', 'h1tler', 'kkk_member',
      'grape_rapist', 'rapist', 'n1gga', 'retard', 'tits_out', 'p0rn_star', 'pedo', 'killyourself'])
      expect(usernameBlocked(bad), bad).toBe(true);
  });

  it('refuses names that pose as BrainScroll or its staff', () => {
    for (const bad of ['brainscroll', 'the_drscroll', 'admin_team', 'moderator1', 'official_help', 'brainscroll_support'])
      expect(usernameBlocked(bad), bad).toBe(true);
  });

  it('reads reserved names on the whole name, so splitting or look-alikes can\'t sneak them in (QA 2026-10-03)', () => {
    for (const bad of ['dr_scroll', 'brain_scroll', 'brainscroii', 'dr_scro11', 'd_r_scroll', 'doctor_scroll', 'drscrolll', 'brainscroll'])
      expect(usernameBlocked(bad), bad).toBe(true);
    for (const ok of ['scroll_lover', 'brain_fan', 'dr_who_fan', 'scrolling'])
      expect(usernameBlocked(ok), ok).toBe(false);
  });

  it('lets innocent phrases through, and catches more spellings (QA 2026-10-03)', () => {
    for (const ok of ['rapeseed', 'rapeseed_oil', 'cum_laude', 'cumlaude', 'sex_ed', 'hoe_down', 'tit_for_tat', 'pussycat', 'dick_grayson'])
      expect(usernameBlocked(ok), ok).toBe(false);
    for (const bad of ['fvck', 'phuck', 'f0ck', 'phuck_off', 'big_dick', 'cum_shot_99', 'sex_kitten', 'tit_fan'])
      expect(usernameBlocked(bad), bad).toBe(true);
  });

  it('reads one-letter parts as one word', () => {
    expect(usernameParts('f_u_c_k_off')).toEqual(['fuck', 'off']);
    expect(usernameParts('a_b_cd')).toEqual(['ab', 'cd']);
  });
});

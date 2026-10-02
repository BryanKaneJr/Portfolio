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

  it('reads one-letter parts as one word', () => {
    expect(usernameParts('f_u_c_k_off')).toEqual(['fuck', 'off']);
    expect(usernameParts('a_b_cd')).toEqual(['ab', 'cd']);
  });
});

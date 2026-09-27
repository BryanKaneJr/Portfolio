# Level data for Chapter 9 of arts.film_tv (Levels 81 to 90).
W = "https://en.wikipedia.org/wiki/"

# New concepts: id -> (title, description, difficulty, [facts])
# fact: (slug, text, [sourceIds], evidence, [urls])
CONCEPTS = {}
def concept(cid, title, desc, diff, facts):
    CONCEPTS[cid] = (title, desc, diff, facts)

# ---------- Level 81 ----------
concept("new_hollywood_rise", "New Hollywood: directors take control",
        "From the late 1960s, surprise hits, television and foreign films pushed Hollywood toward young, film-school-trained directors, until blockbusters and costly flops swung control back to the studios.", 0.35, [
    ("new_hollywood_era", "New Hollywood ran roughly from the mid-1960s to the early 1980s and began with surprise hits such as Bonnie and Clyde (1967), The Graduate (1967) and Easy Rider (1969).",
     ["source.brit_new_hollywood"], "Wikipedia (New Hollywood) dates the movement from the mid-1960s to the early 1980s and lists Bonnie and Clyde, The Graduate and Easy Rider among its first successes.", [W + "New_Hollywood"]),
    ("new_hollywood_tv_and_imports", "Audiences were increasingly drawn to television, and many were drawn to innovative foreign films such as the French New Wave, Italian Neorealism and Kurosawa Akira's work.",
     ["source.brit_new_hollywood"], "Wikipedia (New Hollywood) describes young audiences finding relevance in films from France, Italy and Japan, especially the French New Wave, while television drew viewers away.", [W + "New_Hollywood"]),
    ("new_hollywood_movie_brats", "In the early 1970s a younger cohort nicknamed the movie brats, including Coppola, Lucas, Scorsese and Spielberg, often came to Hollywood through newly established film schools.",
     ["source.brit_new_hollywood"], "Wikipedia (New Hollywood) names Coppola, Lucas, Scorsese and Spielberg among the 'movie brats' educated at film schools such as USC, UCLA and NYU.", [W + "New_Hollywood"]),
    ("new_hollywood_director_driven", "Britannica describes New Hollywood films as a decisive rejection of the old studio system in favor of director-driven creativity and experimentation.",
     ["source.brit_new_hollywood"], "Wikipedia (New Hollywood) describes a movement in which young directors gained control over production, displacing the old studio system.", [W + "New_Hollywood"]),
    ("new_hollywood_blockbuster_turn", "After the massive success of Jaws (1975), studios began prioritizing potential blockbusters and steering away from experimental, director-driven projects.",
     ["source.brit_new_hollywood"], "Wikipedia (New Hollywood) cites Peter Biskind: the success of Jaws and Star Wars made studios realize the importance of blockbusters, advertising and control over production.", [W + "New_Hollywood"]),
    ("new_hollywood_heavens_gate", "Michael Cimino's Heaven's Gate (1980) went nearly four times over an already huge budget, was proportionately one of the biggest failures in movie history and was a disaster for United Artists.",
     ["source.brit_heavens_gate_film"], "Wikipedia (Heaven's Gate) says Cimino pushed the film nearly four times over its planned budget, it earned about $3.5 million, and Transamerica sold United Artists in 1981.", [W + "Heaven%27s_Gate_(film)"]),
    ("new_hollywood_heavens_gate_western", "Heaven's Gate was an epic Western, and its failure ended most studios' interest in reviving the Western genre.",
     ["source.brit_heavens_gate_film"], "Wikipedia (Heaven's Gate) calls the epic Western a major financial disaster for United Artists and for the western genre, followed by tighter studio control.", [W + "Heaven%27s_Gate_(film)"]),
])
concept("new_hollywood_new_wave_borrowing", "Bonnie and Clyde borrows from the French New Wave",
        "Bonnie and Clyde's writers wanted Truffaut or Godard to direct it, and the film's editing drew on their work.", 0.35, [
    ("new_hollywood_bonnie_clyde_penn", "Bonnie and Clyde (1967), directed by Arthur Penn, tore down barriers in the screen depiction of violence and sexuality.",
     ["source.brit_bonnie_and_clyde_film"], "Wikipedia (Bonnie and Clyde, film) calls it a turning point directed by Arthur Penn that broke taboos, including its graphic violence.", [W + "Bonnie_and_Clyde_(film)"]),
    ("new_hollywood_bonnie_clyde_script", "Screenwriters David Newman and Robert Benton loved the work of Truffaut and Godard; Truffaut, their first choice to direct, passed, and Godard also declined.",
     ["source.tcm_bonnie_and_clyde_big_idea"], "Wikipedia (Bonnie and Clyde, film): the New Wave-inspired script by Newman and Benton was offered to Truffaut, then to Godard; both declined.", [W + "Bonnie_and_Clyde_(film)"]),
    ("new_hollywood_bonnie_clyde_editing", "Bonnie and Clyde was made with editing techniques inspired by the work of Jean-Luc Godard and François Truffaut.",
     ["source.brit_new_hollywood"], "Wikipedia (Bonnie and Clyde, film) and Senses of Cinema's 'Riding the New Wave' describe the film's style as drawing on the French New Wave, especially Godard and Truffaut.", [W + "Bonnie_and_Clyde_(film)", "https://www.sensesofcinema.com/2006/feature-articles/bonnie_and_clyde/"]),
])

# ---------- Level 82 ----------
concept("jaws_summer_blockbuster", "Jaws makes summer the blockbuster season",
        "Summer had been the season for lesser films until Jaws in 1975 became the first summer blockbuster and set the marketing pattern that followed.", 0.3, [
    ("jaws_release_1975", "Jaws, Steven Spielberg's Universal film of Peter Benchley's 1974 novel, was first released on June 20, 1975.",
     ["source.brit_jaws_film"], "Wikipedia (Jaws, film): the Universal film directed by Spielberg from Benchley's 1974 novel opened on June 20, 1975.", [W + "Jaws_(film)"]),
    ("jaws_summer_lesser_films", "Before Jaws, summer releases were typically reserved for lesser films, because audiences then tended to avoid going to the movies in summer.",
     ["source.brit_jaws_film"], "Wikipedia (Summer blockbuster) notes that before Jaws, summer was considered a poor season for films, and studios released weaker films then.", [W + "Summer_blockbuster"]),
    ("jaws_first_summer_blockbuster", "Jaws is considered the first summer blockbuster; its marketing tactics became the standard for summer blockbusters and changed how Hollywood marketed and distributed films.",
     ["source.brit_jaws_film"], "Wikipedia (Jaws, film) calls it the prototypical summer blockbuster whose wide release and TV advertising became the model for later releases.", [W + "Jaws_(film)"]),
])
concept("jaws_wide_release", "Jaws opens everywhere at once",
        "Instead of opening city by city, Jaws opened in more than 400 US theaters at once, backed by television trailers.", 0.3, [
    ("jaws_city_by_city", "Before Jaws, films typically opened first in a major city, then debuted in other cities and towns over the course of several weeks.",
     ["source.brit_jaws_film"], "Wikipedia (Jaws, film): most major films then used a platform release, opening in select big-city theaters and expanding gradually.", [W + "Jaws_(film)"]),
    ("jaws_400_theaters", "Jaws opened in more than 400 theaters across the United States on its first weekend.",
     ["source.brit_jaws_film"], "Wikipedia (Jaws, film): it opened on 464 screens, 409 of them in the United States.", [W + "Jaws_(film)"]),
    ("jaws_tv_trailers", "In the week before its release, Jaws was heavily promoted on television with 30-second trailers.",
     ["source.brit_jaws_film"], "Wikipedia (Jaws, film): Universal ran about two dozen 30-second ads nightly on prime-time network TV before the opening.", [W + "Jaws_(film)"]),
])

# ---------- Level 83 ----------
concept("betamax_case", "The Betamax case",
        "Universal sued Sony over home recording; in 1984 the Supreme Court held that selling VCRs was not contributory infringement and that time-shifting was fair use.", 0.35, [
    ("betamax_studios_resisted", "Movie studios at first resisted the VCR, as they had resisted television some three decades earlier.",
     ["source.ebsco_home_video_rentals"], "Wikipedia (Video rental shop): studios fought home video, and Universal and Disney sued Sony in 1976 hoping to stop VCR sales.", [W + "Video_rental_shop"]),
    ("betamax_universal_sued", "Universal City Studios sued Sony, arguing that because Betamax owners recorded its copyrighted TV programs, Sony was liable for their infringement.",
     ["source.oyez_sony_v_universal"], "Wikipedia (Sony Corp. of America v. Universal City Studios): Universal and Disney sued Sony, alleging it was liable for purchasers' infringement.", [W + "Sony_Corp._of_America_v._Universal_City_Studios,_Inc."]),
    ("betamax_ruling_1984", "On January 17, 1984, the Supreme Court ruled 5 to 4, in an opinion by Justice John Paul Stevens, that selling VCRs to the public was not contributory infringement.",
     ["source.oyez_sony_v_universal"], "Wikipedia (Sony v. Universal) gives the decision date January 17, 1984, a 5 to 4 vote, and Stevens's majority opinion.", [W + "Sony_Corp._of_America_v._Universal_City_Studios,_Inc."]),
    ("betamax_time_shifting", "The Court held that recording a broadcast to watch later at home, called time-shifting, was fair use, and that copying equipment may be sold if capable of substantial noninfringing uses.",
     ["source.oyez_sony_v_universal"], "Wikipedia (Sony v. Universal): personal time-shifting is fair use, and devices with significant noninfringing uses escape contributory liability.", [W + "Sony_Corp._of_America_v._Universal_City_Studios,_Inc."]),
])
concept("video_rental_economy", "Rentals become part of a film's income",
        "Expensive tapes made renting the norm, and by the mid-1980s rentals were a significant share of what a film earned.", 0.3, [
    ("video_rental_prices", "In the early 1980s, prerecorded tapes often cost $100 or more, so most people paid around five dollars to rent a video, sometimes with a player, for a night or a few days.",
     ["source.ebsco_home_video_rentals"], "Wikipedia (Video rental shop): high prices for prerecorded tapes made buying prohibitive, driving consumers to rent instead.", [W + "Video_rental_shop"]),
    ("video_studios_sell_tapes", "By 1983 most studios had stopped trying to license their films on video and began selling tapes to rental stores and home users.",
     ["source.ebsco_home_video_rentals"], "Wikipedia (Video rental shop) describes studios moving from opposing rentals to selling tapes to rental stores as the market grew.", [W + "Video_rental_shop"]),
    ("video_rental_revenue", "Video rentals soon made up a significant share of a film's total revenue, and Hollywood began planning for rental income when setting film budgets.",
     ["source.ebsco_home_video_rentals"], "Wikipedia (Video rental shop): in 1987 home video revenues for the year surpassed box office revenues.", [W + "Video_rental_shop"]),
])

# ---------- Level 84 ----------
concept("indie_outside_studios", "Independent film: made outside the studios",
        "An independent film is made outside the major studio system; with little money, Cassavetes and Romero found new ways to work.", 0.35, [
    ("indie_definition", "Independent film refers to films produced outside the major film studio system.",
     ["source.brit_independent_film"], "Wikipedia (Independent film): a feature film produced outside the major film studio system.", [W + "Independent_film"]),
    ("indie_shadows_radio_appeal", "John Cassavetes financed his first film as director, Shadows, partly with donations sent after he appealed for money on a radio program.",
     ["source.brit_cassavetes"], "Wikipedia (Shadows) and (John Cassavetes): he raised money from friends, family and listeners of Jean Shepherd's radio show Night People.", [W + "Shadows_(1958_film)", W + "John_Cassavetes"]),
    ("indie_shadows_16mm", "Shadows was shot on 16-mm film over about two and a half years and was semi-improvised.",
     ["source.brit_cassavetes"], "Wikipedia (Shadows): shot on 16 mm film with improvised dialogue from an outline, then reworked into a 1959 version.", [W + "Shadows_(1958_film)"]),
    ("indie_shadows_inaugurated", "Shadows (1959) is generally acknowledged to have inaugurated the American independent filmmaking movement.",
     ["source.brit_cassavetes"], "Wikipedia (Shadows): film scholars regard it as a watershed in American independent film; it entered the National Film Registry in 1993.", [W + "Shadows_(1958_film)"]),
    ("indie_cassavetes_acting", "Cassavetes paid for later films with his acting, which was sought after by the same studios that were reluctant to back his directing.",
     ["source.brit_cassavetes"], "Wikipedia (John Cassavetes): payment for TV and film acting let him make his later films independent of any studio, which were often unwilling to finance him.", [W + "John_Cassavetes"]),
    ("indie_romero_night", "In 1968 George Romero and several friends pooled their money to make the low-budget Night of the Living Dead, which major studios rejected but which became a cult favorite.",
     ["source.brit_romero", "source.brit_night_of_the_living_dead"], "Wikipedia (Night of the Living Dead): made by Image Ten, whose members each invested; Columbia and AIP declined it; it gained a cult following.", [W + "Night_of_the_Living_Dead"]),
    ("indie_romero_zombie_pattern", "Night of the Living Dead set the pattern for modern zombie movies by separating the monsters from Vodou and using contemporary settings.",
     ["source.brit_night_of_the_living_dead"], "Wikipedia (Night of the Living Dead): regarded as a launching pad for the modern zombie movie, replacing the Haitian folklore zombie.", [W + "Night_of_the_Living_Dead"]),
])
concept("indie_sundance", "Sundance: a stage for independent film",
        "Begun in 1978 as the Utah/US Film Festival and later run by Redford's Sundance Institute, Sundance became known for launching independent filmmakers.", 0.3, [
    ("indie_sundance_origins", "The Sundance Film Festival began in 1978 in Salt Lake City as the Utah/United States Film Festival, came under Robert Redford's Sundance Institute, founded to nurture independent filmmakers, and took the Sundance name in 1991.",
     ["source.brit_sundance_festival"], "Wikipedia (Sundance Film Festival): began in Salt Lake City in 1978 as the Utah/US Film Festival, run by the Sundance Institute from the mid-1980s, renamed in 1991.", [W + "Sundance_Film_Festival"]),
    ("indie_sundance_careers", "Sundance became known for jump-starting the careers of American independent filmmakers, including the Coen brothers, Steven Soderbergh and Quentin Tarantino.",
     ["source.brit_sundance_festival"], "Wikipedia (Sundance Film Festival) names Soderbergh, Tarantino and the Coen brothers among directors who gained early exposure there.", [W + "Sundance_Film_Festival"]),
])

# ---------- Level 85 ----------
concept("miniature_effects", "Miniatures and forced perspective",
        "Scale models are cheap and easy to handle; filmed faster than 24 frames per second and placed near the lens, they can pass for full-size things.", 0.35, [
    ("miniature_inexpensive", "Miniatures, or scale models, are often used in special effects because they are relatively inexpensive and easy to handle.",
     ["source.brit_mpt_special_effects"], "Wikipedia (Miniature effect): miniatures stand in for things too expensive or difficult to film in reality.", [W + "Miniature_effect"]),
    ("miniature_high_speed", "Models may be filmed at more than 24 frames per second, so they play back in slow motion, for more realistic-looking perspective and time scale.",
     ["source.brit_mpt_special_effects"], "HowToFilmSchool and Cinematography.net explain overcranking miniatures: higher frame rates slow the action so a model seems larger.", ["https://howtofilmschool.com/dictionary/overcrank/", "https://www.cinematography.net/edited-pages/Miniaturesfps.htm"]),
    ("miniature_forced_perspective", "Forced perspective makes objects look larger, smaller, nearer or farther than they are: the closer something is to the camera, the larger it appears.",
     ["source.nfi_forced_perspective"], "Wikipedia (Miniature effect): a foreground miniature placed very close to the lens is called forced perspective.", [W + "Miniature_effect", W + "Forced_perspective"]),
])
concept("matte_painting_glass", "Matte paintings on glass",
        "Painters put scenery on glass in front of the camera and filmed the action through the clear parts, a method credited to Norman Dawn in 1907.", 0.3, [
    ("matte_dawn_1907", "Matte painting is attributed to filmmaker Norman Dawn, who first used it in his 1907 film Missions of California.",
     ["source.uh_engines_matte_painting"], "Wikipedia (Matte painting): the first known matte painting shot was made in 1907 by Norman Dawn for Missions of California.", [W + "Matte_painting", W + "Norman_Dawn"]),
    ("matte_glass_method", "Matte painters painted scenery on glass, leaving parts unpainted; with the glass in front of the camera, actors were filmed through the clear parts.",
     ["source.uh_engines_matte_painting", "source.brit_mpt_special_effects"], "Wikipedia (Matte painting): artists painted on glass placed before the camera, with unpainted areas letting the live action show through.", [W + "Matte_painting"]),
    ("matte_oz_gone_with_wind", "The distant Emerald City in The Wizard of Oz (1939) is a matte painting, and Gone With the Wind is filled with matte-painted backdrops.",
     ["source.uh_engines_matte_painting"], "Wikipedia (Matte painting) lists The Wizard of Oz (1939) among classic films using the technique.", [W + "Matte_painting"]),
])

# ---------- Level 86 ----------
concept("stop_motion_method", "Stop motion: one pose per frame",
        "Stop-motion animators photograph a model in slightly different positions, one frame at a time, so a second of film can take 24 poses.", 0.3, [
    ("stopmotion_definition", "Stop-motion animation photographs objects in slightly different positions to create the illusion of movement.",
     ["source.brit_harryhausen"], "Wikipedia (Stop motion): objects are manipulated in small increments between individually photographed frames.", [W + "Stop_motion"]),
    ("stopmotion_24_poses", "If a model is moved for every frame, one second of film at the standard 24 frames per second takes 24 separate poses.",
     ["source.brit_harryhausen", "source.brit_mpt_introduction_of_sound"], "Simple arithmetic from the stop-motion definition and the 24 fps sound standard; Wikipedia (Stop motion) confirms one photographed frame per small movement.", [W + "Stop_motion", W + "Frame_rate"]),
    ("stopmotion_skeleton_battle", "For Jason and the Argonauts (1963), Ray Harryhausen spent four months animating a battle between Jason, two Argonauts and an army of skeletons.",
     ["source.brit_jason_argonauts_film"], "Wikipedia (Jason and the Argonauts, 1963 film): it took Harryhausen well over three months to animate the skeleton sequence.", [W + "Jason_and_the_Argonauts_(1963_film)"]),
])
concept("king_kong_stop_motion", "King Kong and Willis O'Brien",
        "King Kong (1933) turned an 18-inch puppet into a star through Willis O'Brien's stop motion, rear projection and mattes, and inspired Ray Harryhausen.", 0.3, [
    ("kong_1933_obrien", "King Kong (1933), directed by Merian C. Cooper and Ernest B. Schoedsack, featured pioneering effects by Willis O'Brien, including stop-motion animation.",
     ["source.brit_king_kong_1933"], "Wikipedia (King Kong, 1933 film): directed by Cooper and Schoedsack, with stop-motion animation by Willis H. O'Brien.", [W + "King_Kong_(1933_film)"]),
    ("kong_18_inch_puppet", "Kong was mainly an 18-inch (45-cm) puppet designed by O'Brien, supplemented by giant arms, hands and feet for close-ups.",
     ["source.brit_king_kong_1933"], "Wikipedia (King Kong, 1933 film): the Kong models were about 14 to 18 inches tall; a large arm and paw were built for close-ups.", [W + "King_Kong_(1933_film)"]),
    ("kong_rear_projection_mattes", "O'Brien combined animated models with live action using miniature rear projection and traveling mattes, which join separately filmed foreground and background.",
     ["source.brit_king_kong_1933"], "Wikipedia (King Kong, 1933 film): rear-screen projection, including tiny screens built into miniatures, combined live actors with stop motion.", [W + "King_Kong_(1933_film)"]),
    ("kong_animated_star", "Britannica calls King Kong the first significant feature film to star an animated character.",
     ["source.brit_king_kong_1933"], "Wikipedia (Stop motion) calls O'Brien's King Kong a milestone whose animated ape interacted convincingly with human actors.", [W + "Stop_motion"]),
    ("kong_harryhausen_inspired", "After seeing King Kong, Ray Harryhausen began making stop-motion films in his parents' garage, and he later worked with Willis O'Brien.",
     ["source.brit_harryhausen"], "Wikipedia (Ray Harryhausen): inspired by King Kong, he experimented with animated shorts; O'Brien became his mentor and he worked on Mighty Joe Young.", [W + "Ray_Harryhausen"]),
])

# ---------- Level 87 ----------
concept("cel_animation", "Cel animation",
        "Characters inked and painted on clear cels are laid over a painted background and photographed, so only the moving parts are drawn.", 0.3, [
    ("cel_definition", "An animation cel is a line drawing on the face of a transparent sheet of cellulose acetate, colored with paint on the back.",
     ["source.aic_barbagallo_disney_cels"], "Wikipedia (Cel): outlines were drawn on the front of transparent sheets and colors applied to the reverse.", [W + "Cel"]),
    ("cel_photographed_over_background", "Painted cels were registered in succession over painted backgrounds and photographed on an animation camera stand.",
     ["source.aic_barbagallo_disney_cels"], "Wikipedia (Cel): characters on cels were layered over static background paintings and photographed.", [W + "Cel"]),
    ("cel_only_moving_parts", "In the cel process, characters drawn on transparent celluloid sheets were laid over painted backgrounds, so only the moving parts had to be drawn.",
     ["source.encyclopedia_com_bray"], "Wikipedia (Cel): layering characters over static backgrounds eliminated the need to redraw backgrounds repeatedly.", [W + "Cel"]),
    ("cel_hurd_patent_1914", "On December 19, 1914, Earl Hurd applied for a patent on using transparent sheets over a background photographed through them.",
     ["source.aic_barbagallo_disney_cels"], "Wikipedia (Cel): the technique is generally attributed to Earl Hurd, who patented the process in 1914.", [W + "Cel", W + "Earl_Hurd"]),
])
concept("snow_white_gamble", "Snow White: Disney's gamble",
        "Snow White and the Seven Dwarfs (1937), the first full-length animated feature from an American studio, was a costly risk called Disney's Folly that became a hit.", 0.3, [
    ("snow_white_first_feature", "Snow White and the Seven Dwarfs (1937) was the first full-length animated feature film from an American studio.",
     ["source.brit_snow_white_1937"], "Wikipedia (Snow White, 1937 film): the first animated feature film produced in the United States and the first cel-animated feature.", [W + "Snow_White_and_the_Seven_Dwarfs_(1937_film)"]),
    ("snow_white_folly", "Snow White was Walt Disney's biggest gamble to date: an expensive production worked on by hundreds of technicians that became known as Disney's Folly.",
     ["source.brit_snow_white_1937"], "Wikipedia (Snow White, 1937 film): insiders called it 'Disney's Folly'; costs ballooned and Disney mortgaged his house to help pay for it.", [W + "Snow_White_and_the_Seven_Dwarfs_(1937_film)"]),
    ("snow_white_sensation", "On release, Snow White was an immediate box-office sensation, and it set the standard for later Disney animated films.",
     ["source.brit_snow_white_1937"], "Wikipedia (Snow White, 1937 film) describes its huge box-office success and its role in launching Disney's run of animated features.", [W + "Snow_White_and_the_Seven_Dwarfs_(1937_film)"]),
])

# ---------- Level 88 ----------
concept("cgi_pipeline", "How a computer makes a picture",
        "Computer animation builds models from polygons, gives them surfaces and light, then generates and renders a sequence of frames.", 0.4, [
    ("cgi_polygon_models", "Computer models such as the Utah Teapot are built from many small polygons and can be shown as a wire-frame image.",
     ["source.brit_computer_graphics"], "Wikipedia (Rendering): surfaces are typically divided into meshes of triangles; curved surfaces are approximated as meshes.", [W + "Rendering_(computer_graphics)", W + "Utah_teapot"]),
    ("cgi_phong_shading", "In Phong shading, each pixel takes into account the surface texture and all light sources, giving more realistic results but slower rendering.",
     ["source.brit_computer_graphics_shading"], "Wikipedia (Phong shading): the reflection model is computed at each pixel, which is more expensive than Gouraud shading.", [W + "Phong_shading"]),
    ("cgi_ray_tracing", "Ray tracing follows imaginary rays of light through a scene using the laws of reflection and refraction, and is computationally expensive.",
     ["source.brit_computer_graphics_shading"], "Wikipedia (Rendering): ray casting traces light rays backward from a simulated camera and toward light sources to find shadows.", [W + "Rendering_(computer_graphics)"]),
    ("cgi_sequence_and_inbetweens", "Once a three-dimensional figure is digitized, a computer can generate a sequence of images that move it through space, and computers can supply in-between frames.",
     ["source.brit_computer_animation"], "Wikipedia (Inbetweening): animation software can automatically generate transitional frames by interpolation.", [W + "Inbetweening"]),
])
concept("toy_story_first_cg_feature", "Toy Story, the first computer-animated feature",
        "Toy Story (1995), made by Pixar with Disney, was the first entirely computer-animated feature: 114,240 rendered frames.", 0.3, [
    ("toy_story_first", "Toy Story (1995), directed by John Lasseter and made by Pixar with Disney, was the first entirely computer-animated feature-length film.",
     ["source.brit_toy_story"], "Wikipedia (Toy Story): the first entirely computer-animated feature film, directed by Lasseter, from Pixar and Disney.", [W + "Toy_Story"]),
    ("toy_story_frames", "Toy Story took 114,240 frames of computer animation and 800,000 machine hours to render.",
     ["source.brit_toy_story"], "Wikipedia (Toy Story): 800,000 machine hours and 114,240 frames of animation in total.", [W + "Toy_Story"]),
    ("toy_story_79_minutes", "At 24 frames per second, Toy Story's 114,240 frames make 4,760 seconds, about 79 minutes of film.",
     ["source.brit_toy_story", "source.brit_mpt_introduction_of_sound"], "Simple arithmetic (114,240 / 24 = 4,760 seconds); Wikipedia (Toy Story) gives the frame count and a total of over 77 minutes.", [W + "Toy_Story", W + "Frame_rate"]),
])

# ---------- Level 89 ----------
concept("digital_filmmaking_gains", "What digital gave filmmakers",
        "Digital cameras took over from the 1990s to the mid-2010s; films now travel as files and can be restored digitally.", 0.35, [
    ("digital_rise_1990s", "Digital cinematography, which records images digitally rather than on film, began to take off in the 1990s and had become dominant by the mid-2010s.",
     ["source.ebsco_cinematography"], "Wikipedia (Digital cinematography): gained traction in the late 1990s; by 2013 digital had overtaken film for major productions.", [W + "Digital_cinematography"]),
    ("digital_almost_all_2018", "In 2018 Martin Scorsese wrote that almost all pictures are shot with digital cameras, and even those shot on film are edited, color-timed and finished digitally.",
     ["source.brit_scorsese_film_preservation"], "Wikipedia (Digital cinematography): over 90 percent of major films were shot digitally by 2016.", [W + "Digital_cinematography"]),
    ("digital_cinema_package", "In theaters, a film is now usually shown from a Digital Cinema Package sent over the internet or on a drive plugged into the projector.",
     ["source.brit_scorsese_film_preservation"], "Wikipedia (Digital cinema): films are supplied as DCPs over broadband or satellite, or on hard drives; by 2017 almost all screens were digital.", [W + "Digital_cinema"]),
    ("digital_restoration", "Digital restoration can repair damaged frames, giving old films whole new lives.",
     ["source.brit_scorsese_film_preservation"], "Wikipedia (Film restoration) describes digital scanning and repair of damaged frames as a standard restoration method.", [W + "Film_restoration"]),
])
concept("digital_preservation_risk", "What film still does better",
        "Digital data can vanish unless migrated, and the Academy found no digital format that lasts like film, which advocates also prefer for its look.", 0.35, [
    ("digital_disappears", "Digital information sometimes simply disappears, which has happened to more than one major studio picture, so files must be migrated to each new format.",
     ["source.brit_scorsese_film_preservation"], "Library of Congress Digital Preservation interview with the Academy warns of loss through hardware failure or error each time content is migrated; Wikipedia (Digital cinematography) notes the unresolved archival crisis.", [W + "Digital_cinematography"]),
    ("digital_dilemma_2007", "The Academy's 2007 report The Digital Dilemma found no digital archival master format or process with longevity equivalent to film.",
     ["source.loc_digitalpreservation_ampas"], "Oscars.org (The Digital Dilemma) confirms the November 2007 report; Wikipedia (Digital cinematography) says no digital medium reliably preserves content for a century.", ["https://www.oscars.org/science-technology/sci-tech-projects/digital-dilemma", W + "Digital_cinematography"]),
    ("film_most_reliable", "Scorsese calls film, now on a strong Mylar base, still the most reliable and durable means of preserving movies.",
     ["source.brit_scorsese_film_preservation"], "Wikipedia (Digital cinematography): properly stored film endures, an archival advantage over existing digital formats; the Academy's standards promise 100-year access for film.", [W + "Digital_cinematography", "https://www.digitalpreservation.gov/series/pioneers/ampas.html"]),
    ("film_look_advocates", "Many advocates argue that film has far superior visual quality to digital video.",
     ["source.ebsco_cinematography"], "Wikipedia (Digital cinematography): directors including Christopher Nolan and Quentin Tarantino publicly advocate shooting on film.", [W + "Digital_cinematography"]),
])

# ---------- Level 90 ----------
concept("pixar_path", "Pixar: from a director's company to Toy Story",
        "Lucasfilm's computer division (1979) became Pixar (1986) and, through a 1991 Disney deal, made Toy Story: business and technology together.", 0.35, [
    ("pixar_lucasfilm_1979", "In 1979 Lucasfilm, George Lucas's production company, hired Ed Catmull to lead its new computer division.",
     ["source.brit_pixar"], "Wikipedia (Pixar): began in 1979 as the Graphics Group of Lucasfilm's Computer Division, led by Edwin Catmull.", [W + "Pixar"]),
    ("pixar_spun_off_1986", "In 1986 the computer division was spun off as an independent business, Pixar, controlled by Apple cofounder Steve Jobs.",
     ["source.brit_pixar"], "Wikipedia (Pixar): spun out as a corporation in February 1986 with Steve Jobs as majority shareholder.", [W + "Pixar"]),
    ("pixar_disney_deal_1991", "In 1991 Pixar agreed with Disney to jointly develop, produce and distribute three computer-animated feature films.",
     ["source.brit_pixar"], "Wikipedia (Pixar): in 1991 Pixar made a deal with Disney to produce three computer-animated feature films.", [W + "Pixar"]),
])

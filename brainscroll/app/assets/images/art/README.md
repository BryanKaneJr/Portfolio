# Level art

Drop finished illustrations here, named by their image ID from `docs/image-manifest.md`:

    astronomy.mars.png   rome.colosseum.webp   object.globe.png

PNG or WebP, 1024 × 1024, transparent background. Then run `npm run art:sync` (from `brainscroll/`): the app ships these four to a file, packed into `../art-sheets/` (an instant update carries at most 1,000 files), so a new image only shows once it's packed. Every level whose `art` is that ID shows the image; levels whose art isn't here yet simply show none.

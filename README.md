# The Collection & Art Match

**Live site:** https://harvard-art-collection.vercel.app
**Play the game:** https://harvard-art-collection.vercel.app/game.html

A website for browsing the Harvard Art Museums' collection, paired with **Art Match**, a quiz game that asks players to attribute works of art: who made it, when, and where it comes from. Everything is pulled live from the [Harvard Art Museums API](https://github.com/harvardartmuseums/api-docs).

---

## Background

### Attribution and connoisseurship

Deciding *who made a work of art* is one of the oldest problems in art history. Before archival records or scientific analysis were common, scholars relied on **connoisseurship**: close looking at an artist's hand, such as the way they draw drapery, model a face, or cross-hatch a shadow, to assign authorship. Collectors and museums still rely on attribution, and a work's attribution can change its meaning, its place in history, and its value.

Many works in museum collections carry text that does the attributing for the viewer:

- **Signatures** written into the image, like José del Castillo's "castillo 1755" on a drawing of Saint Teresa
- **Monograms**, such as Daumier's "h.D." or Denman Waldo Ross's "DWR"
- **Printed credit lines** on engravings and lithographs, like "R. Nanteuil ad vivum pingebat et sculpebat" ("Nanteuil painted and engraved this from life")

Art Match hides that text so the player has to attribute the work the way a connoisseur would: by looking at style, technique, subject, and medium.

### Why the Harvard Art Museums

The Harvard Art Museums (the Fogg, Busch-Reisinger, and Arthur M. Sackler museums) hold roughly 250,000 objects spanning antiquity to the present. They include paintings, prints, drawings, photographs, sculpture, and decorative arts from around the world. Their public API exposes catalog data for almost all of them, along with machine-generated image analysis. That makes it possible to build a game that draws from the whole collection rather than a hand-picked set of famous works. Most rounds surface objects a player has never seen before, much like wandering through a museum's storage.

---

## Features

### The Collection (gallery): `index.html`

- Browse the full collection, 24 works per page, with pagination through every page of results
- Keyword search across artists, titles, and cultures
- Filter by classification (Paintings, Prints, Photographs, etc.), loaded from the API with object counts
- Sort by relevance, popularity, date (oldest/newest), title, or random
- Toggle to show only works with images
- Click any work for a detail view with a large image, date, culture, period, medium, technique, dimensions, credit line, description, and a link to the museum's own page

### Art Match (game): `game.html`

Three round types, 10 works each:

| Round | Question | Answer drawn from |
|---|---|---|
| **Who made it?** | Match the work to its artist | The object's person with the role "Artist" |
| **When was it made?** | Guess the century | The object's `century` field |
| **Where is it from?** | Name the culture | The object's `culture` field |

- Four multiple-choice answers per question. The wrong answers come from other works in the same random batch, so they're plausible.
- 100 points per correct answer, plus a streak bonus of +25 per consecutive correct answer (capped at +100)
- Personal best per round type, saved in the browser
- An end-of-round recap showing every work with ✓/✗, each linking to the museum's page

---

## How it works

### Data flow

1. **Picking works.** The game requests 100 random objects with images from `/object?sort=random&hasimage=1`. It keeps only works that have a usable answer for the chosen round; for example, artist rounds skip "Unknown" or "Anonymous" artists. Then it picks 10.
2. **Building choices.** For each work, three wrong answers are sampled from the other works' answers in the batch and shuffled in with the correct one.
3. **Images.** Images come from the museum's image service, resized with `?width=` so thumbnails and full views load quickly. All 10 images are preloaded when a round starts.

### Hiding the answer

The hardest part of the project was keeping the game from giving away its own answers. This happens in two places.

**1. In the title.** Titles often name the answer ("Portrait of Rembrandt…", "A 19th-century French landscape"). Before showing the caption, `redact()` replaces the answer and each meaningful word of it with ▇▇▇. It ignores particles like "van" or "de" so that unrelated words aren't hidden. The full title is revealed once the player answers.

**2. On the artwork itself.** Signatures and printed credits are part of the image, so they can't be removed from the title. Instead, the game uses the museum's **text-recognition annotations** (`/annotation?q=imageid:… AND type:text`). The museum has run Google Vision and AWS Rekognition over its images, and each detected piece of text comes with a bounding box. For each work, `fetchTextBoxes()`:

- fetches every text annotation for the image
- keeps only the text that refers to the answer, using `mentionsAnswer()`:
  - **exact or near-exact matches** of the artist's name, ignoring accents, case, and punctuation, with one-letter tolerance for misreads (for example "Nantevil" for "Nanteuil")
  - **badly misread handwritten signatures** that keep the first letters and a similar length (Castillo's "castillo" was read as "cailbe")
  - **initials and monograms**: 1–2 letter clusters containing one of the artist's initials, or 3-letter clusters containing at least two (so "h.D.", misread as "bh", and "DWR" are caught, but ordinary words like "has" aren't). Common caption words like "par", "de", and "et" are excluded.
- prefers single-word boxes over whole lines, and skips oversized regions, so only the name is covered and the rest of the image stays visible
- converts each box to percentages of the image so it scales with the displayed size

The boxes are drawn as small blurred overlays and fade away after the player answers, revealing the signature.

**Limitations:** text recognition sometimes misses faint or highly stylized signatures, and some images have no annotations at all. In those cases nothing is covered.

### API key

The Harvard Art Museums API requires a free key. The site never stores a key in its code: `config.js` ships blank, and each visitor enters their own key the first time they open the site. The key is saved only in that visitor's browser (`localStorage`) and sent only to `api.harvardartmuseums.org`. Request a key from the [Harvard Art Museums API page](https://harvardartmuseums.org/collections/api).

---

## Project structure

```
index.html   Gallery page
app.js       Gallery logic: search, filters, sorting, pagination, detail view
style.css    Shared styles (light and dark mode)
game.html    Art Match page
game.js      Game logic: rounds, scoring, title redaction, signature/monogram covering
game.css     Game-specific styles
config.js    Optional place for an API key (left blank in this repository)
```

The site is plain HTML, CSS, and JavaScript, with no build step, framework, or server code. All API calls run in the visitor's browser.

## Running it locally

From the project folder:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 and enter your API key when prompted.

## Deployment

The site is deployed on **Vercel** from this repository's `main` branch. Every push to `main` redeploys https://harvard-art-collection.vercel.app automatically.

## Credits

- Collection data and images: [Harvard Art Museums](https://harvardartmuseums.org), via the [Harvard Art Museums API](https://github.com/harvardartmuseums/api-docs). Image text recognition by Google Vision and AWS Rekognition, provided through the API's annotation data.
- Fonts: Cormorant Garamond and Inter, from Google Fonts

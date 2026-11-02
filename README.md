# The Collection & Art Match

**Live site:** https://harvard-art-collection.vercel.app
**Play the game:** https://harvard-art-collection.vercel.app/game.html

A website for browsing the Harvard Art Museums' collection, paired with **Art Match**, a quiz game that asks players to attribute works of art.

## Background

Deciding who made a work of art is one of the oldest questions in art history. Before archival records and scientific analysis were common, scholars relied on **connoisseurship**: close looking at an artist's hand, such as how they draw drapery or cross-hatch a shadow.

Many artworks give the answer away with text: a signature like "castillo 1755", a monogram like Daumier's "h.D.", or a printed credit line on an engraving. Art Match hides that text, so players have to attribute each work by looking at its style, technique, and subject instead. The works come from the Harvard Art Museums' roughly 250,000 objects, so most rounds show pieces a player has never seen before.

## How it works

The site is plain HTML, CSS, and JavaScript. All data and images come live from the [Harvard Art Museums API](https://github.com/harvardartmuseums/api-docs).

- **Gallery (`index.html`, `app.js`):** search, filter by classification, sort, and page through the collection. Click any work for its full details.
- **Game (`game.html`, `game.js`):** three round types: *Who made it?*, *When was it made?* and *Where is it from?* Each round has 10 random works with four answer choices. The wrong choices come from other works in the same batch, and a streak of correct answers earns bonus points.

**Hiding the answer.** Titles that contain the answer are blacked out until the player answers. For text inside the image, the game uses the museum's text-recognition data, which gives the position of every word found in an image. It covers only the words that match the artist's name, including misread handwritten signatures and initials, and leaves the rest of the artwork visible. Everything is revealed after the player answers.

**API key.** The API requires a free key. Visitors enter their own key, which is saved only in their browser and never stored in this repository.

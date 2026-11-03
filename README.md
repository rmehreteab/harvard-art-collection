# Harvard Art Collection 

## Relevant background of the Harvard Art Collection Website

The Harvard Art Museum holds several pieces of art from Vincent van Gogh to Claude Monet. Today, visitors are able to view the collections the museum has to offer. My website introduces users to the over 200,000 objects found in the museum. The interactive matching game is the highlight of our website, where players have to match the artist to their work by looking at its style and technique. Many artworks give the answer away with text that includes an artist's signature, an artist's initial, or a printed credit line on an engraving, but, I've blacked those out, so user's can use their image analysis techniques to guess the artist. The website also includes a search tool where users can type in an artist name and learn about their pieces at the museum. Enjoy the website! 

## How it works

To create the website, I used HTML, CSS, and JavaScript. All data and images come live from the [Harvard Art Museums API](https://github.com/harvardartmuseums/api-docs).

- **Gallery (`index.html`, `app.js`):** search, filter by classification, sort, and page through the collection. Click any work for its full details.
- **Game (`game.html`, `game.js`):** three round types: *Who made it?*, *When was it made?* and *Where is it from?* Each round has 10 random works from the collection with four answer choices. The wrong choices come from other works in the same batch, and a streak of correct answers earns bonus points.

**Hiding the answer.** Titles that contain the answer are blacked out until the player answers. For text inside the image, the game uses the museum's text-recognition data, which gives the position of every word found in an image. It covers only the words that match the artist's name, including misread handwritten signatures and initials, and leaves the rest of the artwork visible. Everything is revealed after the player answers.

**API key.** The API requires a free key. Visitors enter their own key, which is saved only in their browser and never stored in this repository.

**Link to the deployed cloud version:** https://harvard-art-collection.vercel.app

# Campus Confidential

> Blacksburg's only unreliable source for reliable gossip.

Campus Confidential turns live Virginia Tech campus data into funny, tabloid-style headlines. Instead of a plain dashboard, Gemini writes gossip-columnist updates about dining, buses, weather, and Newman Library study rooms.

**Live site:** [campus-confidential.onrender.com](https://campus-confidential.onrender.com)

## What it does

- Polls live campus data every three minutes.
- Saves each raw reading to MongoDB Atlas so the project has history, not just a single moment.
- Sends meaningful changes to Gemini along with the Campus Confidential character cast and recent headlines.
- Shows the latest headlines in a responsive tabloid feed that refreshes every 15 seconds.
- Lets visitors share a headline using the device share sheet or a copy-to-clipboard fallback.
- Includes **HokieAI Sidekick**, a branching three-question mini-chat that returns a personalized campus gossip diagnosis using current public campus facts.

## Live data sources

- **Weather:** National Weather Service forecast data for Blacksburg.
- **Dining:** Virginia Tech Dining's public hours feed.
- **Transit:** Blacksburg Transit's live bus feed, including active buses and occupancy. The app highlights the busiest routes.
- **Study rooms:** Newman Library's public group-study-room booking calendar.

The app does not claim to know physical dining-line lengths or whether someone is sitting in an unreserved library room. Newman availability means the room is unreserved in the public booking calendar.

## Character cast

Dining locations and campus systems become recurring characters: Dietrick, Owens, Deet's, DX, Xpress Lane, Dunkin', Squires, West End, Hokie Grill, Perry Place, Turner Place, Blacksburg Transit, Newman Library, and the weather itself.

## Built with

- Node.js and Express
- MongoDB Atlas with Mongoose
- Google Gemini API
- National Weather Service API
- Virginia Tech Dining public hours data
- Blacksburg Transit live-map data
- Virginia Tech Libraries public room-booking availability

## Run locally

### Prerequisites

- Node.js 18 or newer
- A MongoDB Atlas connection string
- A Gemini API key from Google AI Studio

### Setup

1. Clone the repository and enter the project folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to a new file named `.env`.
4. Add your private values to `.env`:

   ```env
   MONGODB_URI=your-mongodb-atlas-connection-string
   GEMINI_API_KEY=your-gemini-api-key
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000).

The app will immediately poll the sources, then continue polling every three minutes. Visit [http://localhost:3000/api/headlines](http://localhost:3000/api/headlines) to see the raw headline JSON.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `GEMINI_API_KEY` | Yes | Gemini API key |
| `PORT` | No | Server port; defaults to `3000` |
| `POLL_SCHEDULE` | No | Cron schedule for polling; defaults to every 3 minutes |

## Sponsor technologies

Campus Confidential was built for VTHacks and uses both Google Gemini and MongoDB Atlas as core parts of the product: Gemini writes the contextual campus headlines, while MongoDB stores the changing campus snapshots and headline history.

## License

Released under the [MIT License](LICENSE).

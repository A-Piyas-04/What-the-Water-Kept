/**
 * The clue journal.
 *
 * The journal is the game's only concession to telling rather than showing: it
 * records what Wren has actually seen, in her words, so a player who puts the
 * game down for a week can pick the thread back up. It never contains anything
 * the player has not personally found.
 */

export interface ClueDef {
  readonly id: string;
  readonly title: string;
  /** Which chapter it is filed under. */
  readonly chapter: number;
  /** One or two sentences. */
  readonly body: string;
  /** Shown in the journal as the deduction this clue supports. */
  readonly bearing?: string;
}

export const CLUES: readonly ClueDef[] = [
  {
    id: 'clue-fieldbook',
    title: 'The 1964 field book',
    chapter: 1,
    body:
      'A surveyor was working the valley before the flooding and left in a hurry. His last entry says he could see them, and that the paperwork was in order.',
    bearing: 'Someone else has used this lamp.',
  },
  {
    id: 'clue-lantern',
    title: 'The survey lantern',
    chapter: 1,
    body:
      'A brass survey lamp that should not still work. Inside its beam the valley is as it was on the night of the flood, and what the beam shows is solid enough to stand on.',
    bearing: 'The light does not illuminate. It remembers.',
  },
  {
    id: 'clue-notice',
    title: 'The evacuation notice',
    chapter: 2,
    body:
      'Residents were assembled at the chapel at 6pm on 11 April 1964. A second hand has written beneath it: "Low town not told. Ask Edith why."',
    bearing: 'The low town was not evacuated with the rest.',
  },
  {
    id: 'clue-tally',
    title: 'Nineteen chalk marks',
    chapter: 2,
    body:
      'Nineteen marks cut into five groups, chalked on a low-town wall. Someone was down here after the water to count them.',
    bearing: 'Nineteen people were still in the low town.',
  },
  {
    id: 'clue-rule',
    title: 'What the Drowned do',
    chapter: 2,
    body:
      'They do not exist outside the beam and they do not move in the dark. Lighting one is what lets it see you. Dousing the lamp is the only defence.',
    bearing: 'The lamp is both the way through and the danger.',
  },
  {
    id: 'clue-chalk',
    title: 'The children’s chalk',
    chapter: 3,
    body:
      'The ward floor is marked in chalk: a closed mouth along one line of boards, crosses on every other. The children were teaching each other where it was safe to be lit.',
    bearing: 'Follow the hush marks. Avoid the crosses.',
  },
  {
    id: 'clue-register',
    title: 'The school register',
    chapter: 3,
    body:
      'Twelve low-town children were never collected. The last name on the list is Calloway, M., aged four.',
    bearing: 'A Calloway child was in the low town.',
  },
  {
    id: 'clue-martin',
    title: 'Martin’s coat',
    chapter: 3,
    body:
      'A child’s coat with MARTIN on a name tape, sewn in a hand Wren has known all her life. Her mother’s brother, aged four.',
    bearing: 'Edith Calloway had a brother in the low town.',
  },
  {
    id: 'clue-ledger',
    title: 'The gate ledger',
    chapter: 4,
    body:
      'At 2140 the relief gate jammed at 40%. At 2144 Ardbeg advised the dam face was failing, with two thousand people below it. At 2151 the upper gate was opened by E. C., apprentice keeper.',
    bearing: 'Three times: 2140, 2144, 2151.',
  },
  {
    id: 'clue-arithmetic',
    title: 'The arithmetic',
    chapter: 4,
    body:
      'Opening the upper gate drowned the low town immediately. Not opening it would have burst the dam onto two thousand people in Ardbeg. A nineteen-year-old apprentice made that choice alone.',
    bearing: 'Edith chose nineteen over two thousand.',
  },
  {
    id: 'clue-clocks',
    title: 'Three stopped clocks',
    chapter: 5,
    body:
      'Three clocks above the three sluice dials, each stopped at the moment the water reached it: 2140, 2144 and 2151. The same three times as the ledger.',
    bearing: 'Set each dial to the time on the clock above it.',
  },
  {
    id: 'clue-log',
    title: 'Edith’s confession',
    chapter: 5,
    body:
      'A signed statement, filed where the next keeper would find it, taking responsibility by name and listing all nineteen of the dead on the reverse. Her brother Martin is among them.',
    bearing: 'She was never missing. She has been waiting to be read.',
  },
];

export const CLUE_BY_ID: Readonly<Record<string, ClueDef>> = Object.fromEntries(
  CLUES.map((c) => [c.id, c]),
);

export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const ITEMS: readonly ItemDef[] = [
  {
    id: 'item-lantern',
    name: 'Survey lantern',
    description:
      'Brass, 1960s pattern, far too heavy. Shows the valley as it was, and makes what it shows solid.',
  },
  {
    id: 'item-key',
    name: 'Gatehouse key',
    description: 'A long iron key from a board in the gatehouse lobby. Marked TUNNEL, LOWER.',
  },
  {
    id: 'item-crank',
    name: 'Winch crank',
    description: 'A detachable crank handle for the tunnel winch. Square drive, badly worn.',
  },
  {
    id: 'item-log',
    name: 'The gate log',
    description:
      'Edith Calloway’s signed statement of 11 April 1964, with nineteen names on the reverse.',
  },
];

export const ITEM_BY_ID: Readonly<Record<string, ItemDef>> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
);

export const CHAPTER_TITLES: readonly string[] = [
  '',
  'I — The Drained Shore',
  'II — Corran Mill',
  'III — The Sunken Ward',
  'IV — The Mill Tunnels',
  'V — The Gatehouse',
  'VI — The Drowning Gate',
];

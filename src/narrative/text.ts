/**
 * All narrative text.
 *
 * House style: Wren's observations are present-tense and plain. Documents from
 * 1964 are formal, bureaucratic and far more frightening for it. Nothing in
 * here explains the mechanic - the player works the rule out by using it.
 */

export interface TextEntry {
  /** Speaker/source label, shown small above the body. */
  readonly source?: string;
  /** Paragraphs, shown one at a time. */
  readonly lines: readonly string[];
  /** Journal headline, if this text should also be filed. */
  readonly title?: string;
}

export const TEXT: Readonly<Record<string, TextEntry>> = {
  // ------------------------------------------------------------- Chapter 1

  'intro-1': {
    source: 'Wren Calloway',
    lines: [
      'They drained the reservoir on Tuesday. Sixty-one years of water, gone in four days.',
      'Hydrographic survey, they called it. Measure the silt, check the dam face, write it up.',
      'They did not know that the village under it was my mother’s.',
    ],
  },
  'shore-camp': {
    source: 'Survey camp',
    title: 'The first survey',
    lines: [
      'Someone has been here before me. The tent is half down and the stove is cold.',
      'The field book on the crate is dated 1964. Not this survey. The one before the flooding.',
      'They never came back for it.',
    ],
  },
  'shore-fieldbook': {
    source: 'Field book, 1964',
    title: 'Field book, March 1964',
    lines: [
      '"Day 11. Gate crew will not go below the mill after dark. Says the water comes up the tunnels before it comes up the street."',
      '"Day 12. Lamp behaves oddly below the tide line. Keeping notes separate. Nobody would believe this."',
      '"Day 14. I can see them. God forgive us, we are going to drown nineteen people and the engineer says the paperwork is in order."',
    ],
  },
  'shore-lantern': {
    source: 'Wren Calloway',
    title: 'The survey lantern',
    lines: [
      'A survey lamp, brass, filthy, and far too heavy. The glass is intact.',
      'It should not work. There is no cell in it that could have survived a week down here, let alone sixty years.',
      'It works.',
    ],
  },
  'shore-first-light': {
    source: 'Wren Calloway',
    lines: [
      'The light does not fall on the silt. It falls on a street.',
      'Everything inside the beam is dry, and lit, and sixty-one years ago.',
      'Outside it, the valley is still dead.',
    ],
  },
  'shore-sign': {
    source: 'Reservoir notice',
    lines: [
      'CORRAN VALLEY RESERVOIR — NO ACCESS BEYOND THIS POINT.',
      'Water undertaking property. Depth varies. No swimming, no boats, no fishing.',
      'Someone has scratched out "no swimming" and written: no shouting.',
    ],
  },
  'shore-boat': {
    source: 'Wren Calloway',
    lines: [
      'A rowing boat, upside down, half swallowed by silt. The oars are still shipped under the seat.',
      'Whoever turned it over did it from underneath.',
    ],
  },

  // ------------------------------------------------------------- Chapter 2

  'street-arrive': {
    source: 'Wren Calloway',
    lines: [
      'Corran Mill. Population two hundred and six, until the twelfth of April 1964.',
      'The high street is still a street. That is somehow worse than ruins.',
    ],
  },
  'street-bridge': {
    source: 'Wren Calloway',
    lines: [
      'The footbridge went when the water came. There is nothing left of it but the abutments.',
      'Unless I put the light on it. Then there is a bridge.',
      'I am going to have to trust that.',
    ],
  },
  'street-firstdrowned': {
    source: 'Wren Calloway',
    lines: [
      'There is someone standing in the beam.',
      'A woman, in a coat, facing away. She was not there before I lit her and she is not there when the light moves.',
      'When I put the light back on her, she had turned around.',
    ],
  },
  'street-rule': {
    source: 'Wren Calloway',
    title: 'The rule',
    lines: [
      'Twice now. They do not move in the dark. They move when I light them.',
      'So: the lamp shows me the only ground I can walk on, and it is the only thing that can get me killed.',
      'Fine. I have worked with worse instruments.',
    ],
  },
  'street-chapel': {
    source: 'Parish noticeboard',
    title: 'The last notice',
    lines: [
      'EVACUATION — CORRAN MILL. All residents to assemble at the chapel, 6pm, 11 April.',
      'Transport provided to Ardbeg. Bring documents and one case only.',
      'Below, in a different hand: "Low town not told. Ask Edith why."',
    ],
  },
  'street-edith': {
    source: 'Wren Calloway',
    lines: [
      'Edith.',
      'My mother’s name is Edith Calloway. She was nineteen in 1964 and she has never once said the word Corran to me.',
      'She is the one who sent me the posting for this survey.',
    ],
  },
  'street-shopwindow': {
    source: 'Wren Calloway',
    lines: [
      'The grocer’s window is full. Tins, a scale, a card advertising the price of flour.',
      'They did not pack up. They were told at six and the gate opened at half past nine.',
    ],
  },
  'street-tally': {
    source: 'Chalk on the wall',
    title: 'Nineteen',
    lines: [
      'Nineteen marks in chalk, cut into five groups, on the wall of the low town.',
      'Someone counted them. Someone was down here afterwards, counting.',
    ],
  },

  // ------------------------------------------------------------- Chapter 3

  'ward-arrive': {
    source: 'Wren Calloway',
    lines: [
      'The schoolhouse took the infirmary beds when the water came up. Twelve of them, in two rows.',
      'The children’s coats are still on the hooks at the height a child can reach.',
    ],
  },
  'ward-chalk': {
    source: 'Wren Calloway',
    title: 'The children’s chalk',
    lines: [
      'There is chalk on the floor. Not drawings — marks. A closed mouth, over and over, along one line of boards.',
      'And crosses everywhere else.',
      'They were teaching each other. Hush here. Not there.',
    ],
  },
  'ward-choir': {
    source: 'Wren Calloway',
    lines: [
      'They are singing.',
      'Not singing. Holding one note, nineteen of them, and none of them has taken a breath in sixty-one years.',
      'The light finds them whether I want it to or not. Keep it low. Keep it off the beds.',
    ],
  },
  'ward-register': {
    source: 'School register, April 1964',
    title: 'The register',
    lines: [
      'Thirty-one names, and a line drawn under the last twelve in a shaking hand.',
      '"Low town children — not collected. Bus did not come below the mill."',
      'The last name on the list is Calloway, M. Aged four.',
    ],
  },
  'ward-m-calloway': {
    source: 'Wren Calloway',
    lines: [
      'Calloway, M. Aged four.',
      'My mother was nineteen in 1964. She did not have a child.',
      'She had a brother.',
    ],
  },
  'ward-coat': {
    source: 'Wren Calloway',
    lines: [
      'A child’s coat, far too small, with a name tape sewn inside the collar.',
      'The tape says MARTIN. The stitching is the same stitching that is in every hem in my wardrobe.',
    ],
  },

  // ------------------------------------------------------------- Chapter 4

  'tunnels-arrive': {
    source: 'Wren Calloway',
    lines: [
      'The mill tunnels carried water to the wheel, and then they carried the flood.',
      'The gate crew’s notes said the water came up here first. They were right.',
    ],
  },
  'tunnels-ledger': {
    source: 'Gate ledger, 11 April 1964',
    title: 'The gate ledger',
    lines: [
      '"2140. Relief gate jammed at 40%. Upper gate operable. Downstream level rising."',
      '"2144. Ardbeg exchange advises dam face failing. Estimated two thousand persons below the dam if it goes."',
      '"2151. Upper gate opened on my authority. Low town not clear. God help me. — E. C., apprentice keeper."',
    ],
  },
  'tunnels-ec': {
    source: 'Wren Calloway',
    lines: [
      'E. C.',
      'Nineteen years old, alone in a gatehouse, with a jammed relief gate and a dam about to go.',
      'Open the upper gate and drown nineteen people in the low town. Wait, and drown two thousand in Ardbeg.',
      'She was nineteen. She did the arithmetic. She has been doing it every day since.',
    ],
  },
  'tunnels-cart': {
    source: 'Wren Calloway',
    lines: [
      'A spoil cart on a jammed rail, and a counterweight with no cable left on it.',
      'In the beam, the cable is there. The physics of this are going to give me a headache.',
    ],
  },
  'tunnels-martin': {
    source: 'Wren Calloway',
    lines: [
      'There is a small one down here. He does not come at me when I light him.',
      'He stands in the tunnel mouth facing the gatehouse, the way you stand when you are waiting for someone to come out.',
      'He has been waiting in that doorway for sixty-one years.',
    ],
  },

  // ------------------------------------------------------------- Chapter 5

  'gate-arrive': {
    source: 'Wren Calloway',
    lines: [
      'The gatehouse. Three dials for three sluices, and a window that looks down the whole valley.',
      'From this chair, you could see the low town. You could see exactly who was still in it.',
    ],
  },
  'gate-clocks': {
    source: 'Wren Calloway',
    title: 'Three stopped clocks',
    lines: [
      'Three clocks on the gatehouse wall, one above each sluice dial. All three stopped when the water reached them.',
      'Twenty-one forty. Twenty-one forty-four. Twenty-one fifty-one.',
      'The ledger times. The dials are not a lock. They are a record.',
    ],
  },
  'gate-solved': {
    source: 'Wren Calloway',
    lines: [
      'The gate log drops out of the housing the moment the dials match.',
      'Not hidden. Filed. She set the dials to the times in the ledger and left the log where the next keeper would find it.',
      'Nobody came. The next keeper was a reservoir.',
    ],
  },
  'gate-log': {
    source: 'Gate log, final entry',
    title: 'What Edith wrote',
    lines: [
      '"To whoever reads this. I opened the upper gate at 2151 with the low town not clear. I counted nineteen. I have written their names on the other side of this sheet."',
      '"I am told there will be an inquiry and that the paperwork is in order. The paperwork is in order. I want it written down somewhere that it was me and that I knew."',
      '"My brother Martin is on the other side of this sheet. He is four. — Edith Calloway."',
    ],
  },
  'gate-revelation': {
    source: 'Wren Calloway',
    lines: [
      'She did not vanish. She was never missing. She has been sitting in a flat in Ardbeg for sixty-one years with nineteen names in her head and one of them her brother’s.',
      'And when they finally drained it, she could not come down here herself.',
      'So she sent me. Not to clear her name. To have somebody read it.',
    ],
  },

  // ------------------------------------------------------------- Chapter 6

  'finale-arrive': {
    source: 'Wren Calloway',
    lines: [
      'They are refilling it. The inspection is over and nobody told the surveyor still in the valley.',
      'The upper gate is already moving.',
    ],
  },
  'finale-martin': {
    source: 'Wren Calloway',
    lines: [
      'He is in the gate mouth, where he has always been, waiting for his sister to come out of the gatehouse.',
      'I have the log in my hand. I have her handwriting and his name on the back of it.',
      'I can put the light on him. He will see me. He will see that someone came.',
    ],
  },
  'ending-shown': {
    source: 'Wren Calloway',
    title: 'What the water kept',
    lines: [
      'I put the light on him and I held it there while the water came up the street.',
      'He looked at the log, and then at me, and he did the thing none of them had done in sixty-one years.',
      'He stopped waiting.',
      'Eighteen left the valley with me. He walked out first.',
    ],
  },
  'ending-withheld': {
    source: 'Wren Calloway',
    title: 'What the water kept',
    lines: [
      'I doused the lamp and I walked past him in the dark, and he never knew I was there.',
      'He is still waiting for her. He will be waiting when they drain it again.',
      'I took her confession out of the valley and I never showed it to the only person it was addressed to.',
    ],
  },
  'ending-epilogue': {
    source: 'Hydrographic survey report — addendum',
    lines: [
      'Silt depth, dam face condition and sluice operability: as per schedule, attached.',
      'Addendum, para. 14: Surveyor reports nineteen names recovered from the gatehouse log, Corran Mill low town, 11 April 1964. Recommend these be added to the valley memorial, which currently lists none.',
      'Addendum, para. 15: The reservoir was refilled on schedule.',
    ],
  },

  // -------------------------------------------------------------- incidental

  'locked-generic': {
    lines: ['Locked, and the frame has swollen shut. Sixty years of water will do that.'],
  },
  'locked-needs-key': {
    lines: ['Locked. There was a key on a board in the gatehouse, in the beam.'],
  },
  'needs-lantern': {
    lines: ['Too dark to make anything out. There is nothing down here that gives light on its own.'],
  },
  'bridge-hint': {
    source: 'Wren Calloway',
    lines: ['Keep the light on the deck. The moment I take it off, I am standing on 1964.'],
  },
  'drowned-hint': {
    source: 'Wren Calloway',
    lines: ['Off. Hands down, stay low, do not move until it goes back to wherever it stands.'],
  },
  'death-taken': {
    source: '',
    lines: ['She lit it, and it saw her.'],
  },
  'death-drowned': {
    source: '',
    lines: ['The valley took back what it was owed.'],
  },
};

export const getText = (id: string): TextEntry | null => TEXT[id] ?? null;

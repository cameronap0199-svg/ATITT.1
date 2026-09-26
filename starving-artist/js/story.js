// Chapter data: priorities, painting prompts, Inspiration scripts, neglect and journal text.
// Inspiration entries: { kind: 'place'|'empty', idea, at:[x,y] | rel:ideaId + dx/dy, r, text, yes, following }

export const CHAPTERS = [
  {
    title: 'Moving Day', age: 20, when: 'August',
    question: 'Her first apartment. Her first day of the rest of it.',
    create: { label: 'Unfold the easel and paint the view from the new window.', whisper: 'the light is only like this today.' },
    bond: { label: 'Spend the afternoon with Dad before he drives home. Call Mom.', whisper: 'he drove three hours to help.' },
    duty: { label: 'Unpack the kitchen, stock the fridge, set an alarm for your first shift.', whisper: 'work starts at six a.m.' },
    paint: {
      theme: 'The view from my first window', defaultTitle: 'First Window', inspColor: '#ffd24a',
      ideas: ['window', 'sun', 'city', 'tree', 'bird', 'cloud', 'chair', 'flower', 'cat', 'self', 'dad', 'hill'],
      backgrounds: ['dusk', 'dawn', 'room'],
      insp: [
        { kind: 'place', idea: 'sun', at: [150, 62], r: 16, text: 'the sun. low. just there, over the roofs.', yes: 'yes... warm.' },
        { kind: 'place', idea: 'chair', at: [58, 132], r: 18, text: 'a chair by the window. for watching.' },
        { kind: 'empty', rel: 'chair', dx: 28, dy: 0, r: 15, text: 'leave the space beside the chair empty. someone might want to sit.' },
        { kind: 'place', idea: 'bird', at: [104, 38], r: 15, text: 'one bird. only one. going somewhere.' },
      ],
    },
    journal: {
      create: 'I painted the view before I unpacked a single fork.',
      bond: 'Dad and I sat on the floor and ate Mom\'s tamales out of the foil.',
      duty: 'Plates in the cupboard. Alarm set for 5:30. A real adult.',
      neglect: {
        create: 'The easel stayed folded behind the door. There would be time.',
        bond: 'Dad left while I was busy. He left a note: "proud of you. eat something."',
        duty: 'I ate cereal out of a mug for a week. The boxes stayed boxes.',
      },
    },
  },
  {
    title: 'Open Mic', age: 21, when: 'October',
    question: 'One wall. One painting. One night.',
    create: { label: 'Finish the painting for the café\'s art wall and hang it.', whisper: 'Dale said just one. make it count.' },
    bond: { label: 'It\'s Teo\'s 13th birthday. Sit with him and Mom. Give him your present.', whisper: 'they drove in to surprise you.' },
    duty: { label: 'Cover Marcy\'s shift. Make and serve three orders.', whisper: 'rent is due friday.' },
    paint: {
      theme: 'Something that feels like home', defaultTitle: 'Home, Sort Of', inspColor: '#ffe08a',
      ideas: ['house', 'mom', 'dad', 'teo', 'self', 'tree', 'door', 'cake', 'dog', 'lamp', 'heart', 'moon', 'eye'],
      backgrounds: ['home', 'night', 'room'],
      insp: [
        { kind: 'place', idea: 'house', at: [96, 112], r: 18, text: 'a house. in the middle. where everyone can see it.' },
        { kind: 'place', idea: 'door', at: [40, 124], r: 16, text: 'a door, left open. ...or is it closed?' },
        { kind: 'empty', rel: 'house', dx: -40, dy: 10, r: 16, text: 'leave the front yard empty. someone is coming home late.' },
        { kind: 'place', idea: 'eye', at: [96, 34], r: 16, text: 'an eye, up in the sky. so they know you\'re watching over them.', following: true },
      ],
    },
    journal: {
      create: 'My painting hung by the bathroom door. Three people looked at it. One took a picture.',
      bond: 'Teo opened my old sketchbook like it was treasure. He wants to be an artist. God help him.',
      duty: 'Three lattes, no mistakes. Dale said "good hustle," which is the nicest thing he has ever said.',
      neglect: {
        create: 'The art wall stayed empty. Dale hung Marcy\'s watercolor of a duck instead.',
        bond: 'Teo drew me while he waited. He gave me a halo. I never made it to their table.',
        duty: 'Dale cut my hours. "We talked about this, Nate."',
      },
    },
  },
  {
    title: 'Fever', age: 21, when: 'February',
    question: 'The fever came on a Tuesday. It didn\'t leave.',
    create: { label: 'Paint what the fever shows you, while it\'s still showing you.', whisper: 'you\'ll never see like this again.' },
    bond: { label: 'Answer Priya. Let her in. Watch a movie on the couch.', whisper: 'she\'s texted nine times.' },
    duty: { label: 'Take your medicine, eat something warm, email Dale that you\'re sick.', whisper: 'you have missed two shifts.' },
    paint: {
      theme: 'What the fever showed me', defaultTitle: '3:33 AM', inspColor: '#d8b8ff',
      ideas: ['bed', 'eye', 'clock', 'rain', 'hand', 'door', 'stairs', 'self', 'mirror', 'moon', 'cat', 'flower'],
      backgrounds: ['fever', 'night', 'blank'],
      insp: [
        { kind: 'place', idea: 'bed', at: [96, 130], r: 18, text: 'the bed. you haven\'t left it in days, have you.' },
        { kind: 'empty', rel: 'bed', dx: 30, dy: -2, r: 16, text: 'leave the foot of the bed empty. something stands there at night.' },
        { kind: 'place', idea: 'clock', at: [40, 42], r: 15, text: 'a clock. it\'s always 3:33 now.' },
        { kind: 'place', idea: 'eye', at: [152, 40], r: 15, text: 'they would understand this. let them see it.', following: true },
        { kind: 'place', idea: 'door', at: [172, 122], r: 16, text: 'a door you don\'t remember painting.' },
      ],
    },
    journal: {
      create: 'I painted with a 102° fever. It is the best thing I have ever made. I think.',
      bond: 'Priya made me watch Spirited Away and fell asleep before the bathhouse. She got the Portland job.',
      duty: 'Pills, soup, sleep. The fever broke Thursday. I felt stupid for how easy it was.',
      neglect: {
        create: 'I turned the canvases to face the wall. They kept looking anyway.',
        bond: 'Priya knocked for a long time. She left soup outside my door. It went cold.',
        duty: 'The fever broke four days later. The urgent care bill didn\'t.',
      },
    },
  },
  {
    title: 'The Commission', age: 22, when: 'April',
    question: 'A stranger with 40,000 followers wants to buy her.',
    create: { label: 'Read @thevistavenue\'s message. Paint the commission.', whisper: '$800. and they said "genius".' },
    bond: { label: 'Mom is at the door with groceries. Let her in. Have lunch together.', whisper: 'she drove in without calling.' },
    duty: { label: 'Pay the overdue rent, take out the trash, call Dale about your shift.', whisper: 'the landlord taped a notice to the door.' },
    paint: {
      theme: 'Paint yourself. Not how you look. How you ARE.', defaultTitle: 'Self-Portrait (Commission)', inspColor: '#ff9ab0',
      ideas: ['self', 'mirror', 'mask', 'crowd', 'eye', 'frame', 'halo', 'hand', 'flower', 'heart', 'brush', 'star'],
      backgrounds: ['mirror', 'gallery', 'blank'],
      insp: [
        { kind: 'place', idea: 'self', at: [96, 128], r: 18, text: 'you. in the center. they want to see you.' },
        { kind: 'place', idea: 'halo', rel: 'self', dx: 0, dy: -30, r: 16, text: 'give yourself a halo. they\'ll love that.', following: true },
        { kind: 'place', idea: 'crowd', at: [96, 142], r: 20, text: 'an audience. at your feet.', following: true },
        { kind: 'empty', rel: 'self', dx: -34, dy: 0, r: 16, text: 'leave room beside you. for who you used to be.' },
        { kind: 'place', idea: 'mask', rel: 'self', dx: 0, dy: -22, r: 14, text: 'or... a mask. it\'s easier than a face.', following: true },
      ],
    },
    journal: {
      create: '@thevistavenue paid in an hour. "Genius," they wrote. "They\'re going to love you."',
      bond: 'Mom brought pozole and didn\'t say anything about how thin I am. She said it with her eyes.',
      duty: 'Rent paid. Trash out. I picked up a Saturday shift. I am so tired.',
      neglect: {
        create: '"That\'s disappointing, Nate. We believed in you." — @thevistavenue. I blocked them. They came back.',
        bond: 'Mom left the groceries outside the door. A note: "You didn\'t answer. I love you. EAT."',
        duty: 'FINAL NOTICE, in red, taped to my door where everybody could see.',
      },
    },
  },
  {
    title: 'Holiday', age: 22, when: 'December',
    question: 'She came home for Christmas. The house is smaller than she remembers.',
    create: { label: 'Slip upstairs to your old room and paint.', whisper: '4,000 people are waiting for a new post.' },
    bond: { label: 'Sit down for dinner with the family. Open presents with Teo.', whisper: 'Teo saved you the seat by the window.' },
    duty: { label: 'Take your medication, call the landlord back, sleep before midnight.', whisper: 'the landlord has called three times.' },
    paint: {
      theme: 'Home for the holidays', defaultTitle: 'Snow Globe', inspColor: '#e8e8f0',
      ideas: ['house', 'snow', 'tree', 'mom', 'dad', 'teo', 'self', 'gift', 'candle', 'window', 'crowd', 'eye', 'star'],
      backgrounds: ['snow', 'home', 'night'],
      insp: [
        { kind: 'place', idea: 'window', at: [96, 76], r: 18, text: 'paint the house from outside. through the window.' },
        { kind: 'empty', rel: 'window', dx: 0, dy: 44, r: 16, text: 'leave one place at the table empty.' },
        { kind: 'place', idea: 'crowd', at: [40, 136], r: 18, text: 'they\'d rather have this than dinner. your followers.', following: true },
        { kind: 'place', idea: 'self', at: [168, 130], r: 16, text: 'you, outside. in the snow. looking in.' },
        { kind: 'place', idea: 'eye', at: [96, 26], r: 15, text: 'let them watch. they\'re all that\'s watching.', following: true },
      ],
    },
    journal: {
      create: 'I painted in my old room while everyone laughed downstairs. It got 11,000 likes.',
      bond: 'Dad carved. Teo showed me his second sketchbook. Mom cried at the gift I made her.',
      duty: 'Meds. Landlord. Bed by eleven. Mom checked on me like I was nine. I let her.',
      neglect: {
        create: 'I didn\'t paint all week. Something upstairs kept whispering that I was wasting it.',
        bond: 'They ate without me. Teo stopped asking. "It\'s fine. You\'re busy."',
        duty: 'I fell asleep at 4 AM with my phone on my face. The landlord stopped calling. That was worse.',
      },
    },
  },
  {
    title: 'The Opening', age: 23, when: 'May',
    question: '"NATE — NEW WORK." Everyone came. Priya\'s train leaves at nine.',
    create: { label: 'Finish the centerpiece live, in front of everyone.', whisper: 'they came for the art, Nate.' },
    bond: { label: 'Say goodbye to Priya before her train. Find your family in the crowd.', whisper: 'she is moving 2,000 miles away tonight.' },
    duty: { label: 'Sign the gallery contract. Eat something. You haven\'t in two days.', whisper: 'Vivian\'s lawyer is waiting.' },
    paint: {
      theme: 'The centerpiece. Everyone is watching.', defaultTitle: 'Everyone Is Watching', inspColor: '#ff5a6a',
      ideas: ['self', 'crowd', 'eye', 'halo', 'mask', 'stairs', 'door', 'train', 'suitcase', 'priya', 'heart', 'frame', 'star', 'flower'],
      backgrounds: ['gallery', 'blank', 'dusk'],
      insp: [
        { kind: 'place', idea: 'crowd', at: [96, 140], r: 20, text: 'them. all of them. they came for you.', following: true },
        { kind: 'place', idea: 'stairs', at: [110, 122], r: 18, text: 'stairs. going up. only up.' },
        { kind: 'place', idea: 'self', rel: 'stairs', dx: 14, dy: -34, r: 16, text: 'you, at the top. alone is how it looks from up there.' },
        { kind: 'empty', at: [36, 122], r: 16, text: 'leave the doorway empty. she\'s leaving anyway.' },
        { kind: 'place', idea: 'halo', rel: 'self', dx: 0, dy: -30, r: 15, text: 'you\'ve earned it. you\'ve given them everything.', following: true },
        { kind: 'place', idea: 'eye', at: [30, 30], r: 15, text: 'and one more eye. there are always more.', following: true },
      ],
    },
    journal: {
      create: 'I finished it live. They clapped like a machine. Someone in the back was crying. I think it was me.',
      bond: 'I ran to the platform. Priya hugged me so hard my ribs hurt. "Don\'t disappear, okay?"',
      duty: 'Signed. Ate three of the little sandwiches. Vivian called me "a professional." I don\'t feel like one.',
      neglect: {
        create: 'The centerpiece stayed white. They chanted until Vivian turned the lights up.',
        bond: 'Priya\'s text: "i waited. it\'s ok. i love you. don\'t disappear, okay?"',
        duty: 'I fainted during the toast. I woke up on the floor with forty phones pointed at me.',
      },
    },
  },
];

export const FINAL_PAINT = {
  theme: 'Natalee. Who are you, when nobody is watching?', defaultTitle: 'Natalee', inspColor: '#ffffff',
  ideas: ['self', 'mom', 'dad', 'teo', 'priya', 'house', 'heart', 'brush', 'sun', 'flower', 'crowd', 'halo', 'mask', 'eye'],
  backgrounds: ['blank', 'home', 'dawn', 'gallery'],
  insp: [
    { kind: 'place', idea: 'crowd', at: [96, 140], r: 20, text: 'put them in. they\'re all you have left.', following: true },
    { kind: 'place', idea: 'halo', at: [96, 64], r: 16, text: 'a halo. that\'s how they\'ll remember you.', following: true },
    { kind: 'empty', at: [140, 124], r: 18, text: 'leave the space beside you empty. we\'ll fill it.', following: true },
    { kind: 'place', idea: 'mask', at: [96, 84], r: 15, text: 'wear this. it\'s the face they love.', following: true },
    { kind: 'place', idea: 'eye', at: [40, 36], r: 15, text: 'we are always watching. isn\'t that what you wanted?', following: true },
    { kind: 'place', idea: 'eye', at: [152, 36], r: 15, text: 'give us more of you. just a little more.', following: true },
  ],
};

export const ENDINGS = {
  good: {
    name: 'NATALEE',
    lines: [
      'She finished the painting and signed it with her whole name.',
      'She never got famous. A few people bought her work. Most didn\'t.',
      'She taught Saturday art classes. Teo became a better painter than her, and she told everyone.',
      'On Sundays she called her mother. Sometimes she even called first.',
      'Nate is happy being Natalee.',
      'And that is enough.',
    ],
  },
  gone: {
    name: 'GONE',
    lines: [
      'The painting went viral before the paint was dry.',
      'The Following grew. They called her a genius. They called her theirs.',
      'One morning her apartment was empty. The easel was facing the wall.',
      'Her mother still calls every Sunday. Her father drives the three hours twice a month.',
      'Teo pins her face to telephone poles in cities she never lived in.',
      'Nate disappeared. But she was not forgotten. They are still looking.',
    ],
  },
  bad: {
    name: 'CULT FOLLOWING',
    lines: [
      'The painting sold for more than her parents\' house.',
      'The Following came for her in a white van, smiling, with flowers.',
      'There was no one close enough to notice she had stopped answering.',
      'Her paintings still appear sometimes. Signed "N." Always a little emptier.',
      'The Cult Following took Nate.',
      'Her fate is unknown.',
    ],
  },
  boring: {
    name: 'BORING',
    lines: [
      'Nate stopped painting.',
      'Not all at once. She just... didn\'t, one day. Then the next day. Then every day.',
      'She moved back in with her parents. She got a job at a bank. It was fine.',
      'Alienate never had anything to wear. It got bored and left.',
      'Her grand psychological horror story ended before it could really begin.',
      'Thanks for not painting in a game called Starving Artist... Jerk.',
    ],
  },
};

// Bible Check verse pool (King James Version, public domain). Each verse lists words
// that can be blanked and plausible decoys for the multiple-choice levels.

export const VERSES = [
  { ref: 'Matthew 5:5', text: 'Blessed are the meek: for they shall inherit the earth.', blanks: ['meek', 'inherit', 'earth'], decoys: ['bold', 'rich', 'loud', 'claim', 'rule', 'stage', 'heavens'] },
  { ref: 'Matthew 5:3', text: 'Blessed are the poor in spirit: for theirs is the kingdom of heaven.', blanks: ['poor', 'spirit', 'kingdom'], decoys: ['proud', 'strong', 'body', 'concert', 'venue', 'rich'] },
  { ref: 'Matthew 5:4', text: 'Blessed are they that mourn: for they shall be comforted.', blanks: ['mourn', 'comforted'], decoys: ['sing', 'dance', 'rewarded', 'famous', 'fed'] },
  { ref: 'Matthew 5:6', text: 'Blessed are they which do hunger and thirst after righteousness: for they shall be filled.', blanks: ['hunger', 'thirst', 'righteousness', 'filled'], decoys: ['fame', 'merch', 'rested', 'praised', 'sleep', 'money'] },
  { ref: 'Matthew 5:7', text: 'Blessed are the merciful: for they shall obtain mercy.', blanks: ['merciful', 'mercy'], decoys: ['faithful', 'glory', 'riches', 'wisdom', 'patient'] },
  { ref: 'Matthew 5:8', text: 'Blessed are the pure in heart: for they shall see God.', blanks: ['pure', 'heart', 'see'], decoys: ['kind', 'spirit', 'hear', 'know', 'strong'] },
  { ref: 'Matthew 5:9', text: 'Blessed are the peacemakers: for they shall be called the children of God.', blanks: ['peacemakers', 'children'], decoys: ['demon hunters', 'faithful', 'servants', 'friends', 'fans'] },
  { ref: 'Matthew 5:14', text: 'Ye are the light of the world. A city that is set on an hill cannot be hid.', blanks: ['light', 'world', 'hill', 'hid'], decoys: ['salt', 'stage', 'moved', 'mountain', 'seen', 'lamp'] },
  { ref: 'Matthew 5:44', text: 'But I say unto you, Love your enemies, bless them that curse you, do good to them that hate you, and pray for them which despitefully use you, and persecute you;', blanks: ['enemies', 'curse', 'hate', 'pray'], decoys: ['friends', 'demons', 'fans', 'praise', 'fight', 'help'] },
  { ref: 'Matthew 6:24', text: 'No man can serve two masters: for either he will hate the one, and love the other; or else he will hold to the one, and despise the other. Ye cannot serve God and mammon.', blanks: ['masters', 'serve', 'mammon'], decoys: ['girlfriends', 'kings', 'idols', 'money', 'follow', 'love'] },
  { ref: 'Matthew 6:34', text: 'Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.', blanks: ['morrow', 'thought', 'Sufficient', 'evil'], decoys: ['concert', 'money', 'Enough', 'trouble', 'worry', 'future'] },
  { ref: 'Matthew 7:7', text: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.', blanks: ['Ask', 'seek', 'find', 'knock', 'opened'], decoys: ['Pray', 'call', 'win', 'wait', 'shown', 'Buy'] },
  { ref: 'Matthew 7:12', text: 'Therefore all things whatsoever ye would that men should do to you, do ye even so to them: for this is the law and the prophets.', blanks: ['law', 'prophets'], decoys: ['gospel', 'apostles', 'truth', 'kings', 'rule'] },
  { ref: 'Matthew 11:28', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', blanks: ['labour', 'heavy', 'rest'], decoys: ['hunger', 'tired', 'strength', 'peace', 'money', 'weary'] },
  { ref: 'Matthew 18:20', text: 'For where two or three are gathered together in my name, there am I in the midst of them.', blanks: ['two', 'three', 'gathered', 'midst'], decoys: ['four', 'ten', 'singing', 'heart', 'center', 'praying'] },
  { ref: 'Matthew 19:24', text: 'And again I say unto you, It is easier for a camel to go through the eye of a needle, than for a rich man to enter into the kingdom of God.', blanks: ['camel', 'needle', 'rich'], decoys: ['horse', 'lion', 'door', 'proud', 'famous', 'wall'] },
  { ref: 'Matthew 22:39', text: 'And the second is like unto it, Thou shalt love thy neighbour as thyself.', blanks: ['love', 'neighbour', 'thyself'], decoys: ['help', 'brother', 'enemy', 'God', 'honour', 'parents'] },
  { ref: 'Matthew 26:41', text: 'Watch and pray, that ye enter not into temptation: the spirit indeed is willing, but the flesh is weak.', blanks: ['Watch', 'temptation', 'willing', 'weak'], decoys: ['Sing', 'trouble', 'strong', 'tired', 'ready', 'hungry'] },
  { ref: 'Matthew 4:4', text: 'But he answered and said, It is written, Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.', blanks: ['bread', 'alone', 'word'], decoys: ['sushi', 'water', 'faith', 'song', 'breath', 'wine'] },
  { ref: 'Mark 8:36', text: 'For what shall it profit a man, if he shall gain the whole world, and lose his own soul?', blanks: ['profit', 'world', 'soul'], decoys: ['matter', 'venue', 'heart', 'life', 'money', 'mind'] },
  { ref: 'Mark 16:15', text: 'And he said unto them, Go ye into all the world, and preach the gospel to every creature.', blanks: ['world', 'preach', 'gospel', 'creature'], decoys: ['city', 'sing', 'truth', 'nation', 'demon', 'fan'] },
  { ref: 'Luke 2:14', text: 'Glory to God in the highest, and on earth peace, good will toward men.', blanks: ['Glory', 'highest', 'peace', 'men'], decoys: ['Praise', 'heaven', 'joy', 'love', 'all', 'fans'] },
  { ref: 'Luke 6:31', text: 'And as ye would that men should do to you, do ye also to them likewise.', blanks: ['likewise'], decoys: ['otherwise', 'always', 'first', 'freely'] },
  { ref: 'Luke 23:34', text: 'Then said Jesus, Father, forgive them; for they know not what they do.', blanks: ['forgive', 'know'], decoys: ['bless', 'save', 'see', 'mean', 'judge'] },
  { ref: 'John 1:1', text: 'In the beginning was the Word, and the Word was with God, and the Word was God.', blanks: ['beginning', 'Word'], decoys: ['end', 'Light', 'Song', 'garden', 'Truth'] },
  { ref: 'John 3:16', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', blanks: ['loved', 'world', 'begotten', 'perish', 'everlasting'], decoys: ['blessed', 'people', 'beloved', 'fall', 'eternal', 'fear'] },
  { ref: 'John 8:32', text: 'And ye shall know the truth, and the truth shall make you free.', blanks: ['truth', 'free'], decoys: ['way', 'strong', 'rich', 'wise', 'whole'] },
  { ref: 'John 11:35', text: 'Jesus wept.', blanks: ['wept'], decoys: ['slept', 'spoke', 'smiled', 'waited'] },
  { ref: 'John 14:6', text: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.', blanks: ['way', 'truth', 'life', 'Father'], decoys: ['light', 'door', 'word', 'Kingdom', 'road', 'heart'] },
  { ref: 'John 15:13', text: 'Greater love hath no man than this, that a man lay down his life for his friends.', blanks: ['Greater', 'life', 'friends'], decoys: ['Truer', 'sword', 'brother', 'enemies', 'soul', 'fans'] },
  { ref: 'John 16:33', text: 'These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world.', blanks: ['peace', 'tribulation', 'cheer', 'overcome'], decoys: ['joy', 'trouble', 'heart', 'defeated', 'rest', 'courage'] },
  { ref: 'Romans 3:23', text: 'For all have sinned, and come short of the glory of God;', blanks: ['sinned', 'short', 'glory'], decoys: ['fallen', 'far', 'grace', 'love', 'strayed'] },
  { ref: 'Romans 6:23', text: 'For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.', blanks: ['wages', 'death', 'gift', 'eternal'], decoys: ['price', 'debt', 'grace', 'everlasting', 'cost', 'reward'] },
  { ref: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.', blanks: ['together', 'good', 'called', 'purpose'], decoys: ['always', 'best', 'chosen', 'plan', 'will', 'glory'] },
  { ref: 'Romans 8:31', text: 'What shall we then say to these things? If God be for us, who can be against us?', blanks: ['against'], decoys: ['beside', 'above', 'before', 'without'] },
  { ref: 'Romans 12:21', text: 'Be not overcome of evil, but overcome evil with good.', blanks: ['overcome', 'evil', 'good'], decoys: ['afraid', 'demons', 'love', 'strength', 'defeat'] },
  { ref: '1 Corinthians 13:4', text: 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,', blanks: ['suffereth', 'kind', 'envieth', 'vaunteth', 'puffed'], decoys: ['patient', 'rude', 'boasteth', 'proud', 'blown', 'waiteth'] },
  { ref: '1 Corinthians 13:13', text: 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.', blanks: ['faith', 'hope', 'charity', 'greatest'], decoys: ['love', 'grace', 'peace', 'truth', 'least', 'joy'] },
  { ref: '1 Corinthians 16:14', text: 'Let all your things be done with charity.', blanks: ['charity'], decoys: ['haste', 'fear', 'music', 'power'] },
  { ref: 'Galatians 6:7', text: 'Be not deceived; God is not mocked: for whatsoever a man soweth, that shall he also reap.', blanks: ['deceived', 'mocked', 'soweth', 'reap'], decoys: ['afraid', 'fooled', 'buyeth', 'keep', 'lose', 'plants'] },
  { ref: 'Ephesians 4:26', text: 'Be ye angry, and sin not: let not the sun go down upon your wrath:', blanks: ['angry', 'sun', 'wrath'], decoys: ['glad', 'moon', 'house', 'anger', 'bed', 'afraid'] },
  { ref: 'Ephesians 6:11', text: 'Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.', blanks: ['armour', 'stand', 'wiles', 'devil'], decoys: ['tour shirt', 'fight', 'demons', 'tricks', 'world', 'shield'] },
  { ref: 'Philippians 4:6', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.', blanks: ['careful', 'prayer', 'thanksgiving', 'requests'], decoys: ['afraid', 'song', 'praise', 'money', 'fasting', 'hearts'] },
  { ref: 'Philippians 4:13', text: 'I can do all things through Christ which strengtheneth me.', blanks: ['all', 'Christ', 'strengtheneth'], decoys: ['great', 'faith', 'loveth', 'saveth', 'many'] },
  { ref: 'Colossians 3:23', text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;', blanks: ['heartily', 'Lord', 'men'], decoys: ['quickly', 'fans', 'idols', 'King', 'boldly'] },
  { ref: '1 Thessalonians 5:17', text: 'Pray without ceasing.', blanks: ['Pray', 'ceasing'], decoys: ['Sing', 'Dash', 'fear', 'stopping', 'rest'] },
  { ref: '2 Timothy 1:7', text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.', blanks: ['fear', 'power', 'love', 'sound'], decoys: ['doubt', 'strength', 'peace', 'clear', 'joy', 'quiet'] },
  { ref: '1 Timothy 6:10', text: 'For the love of money is the root of all evil: which while some coveted after, they have erred from the faith, and pierced themselves through with many sorrows.', blanks: ['money', 'root', 'evil', 'sorrows'], decoys: ['merch', 'seed', 'sin', 'debts', 'fame', 'arrows'] },
  { ref: 'Hebrews 11:1', text: 'Now faith is the substance of things hoped for, the evidence of things not seen.', blanks: ['faith', 'substance', 'hoped', 'evidence'], decoys: ['hope', 'promise', 'prayed', 'proof', 'love', 'shadow'] },
  { ref: 'Hebrews 13:8', text: 'Jesus Christ the same yesterday, and to day, and for ever.', blanks: ['same', 'yesterday', 'ever'], decoys: ['Lord', 'tomorrow', 'always', 'now', 'King'] },
  { ref: 'James 1:19', text: 'Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath:', blanks: ['swift', 'hear', 'speak', 'wrath'], decoys: ['slow', 'forgive', 'sing', 'anger', 'quick', 'judge'] },
  { ref: 'James 4:7', text: 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.', blanks: ['Submit', 'Resist', 'devil', 'flee'], decoys: ['Give', 'Fight', 'demons', 'run', 'Hide', 'leave'] },
  { ref: '1 Peter 5:8', text: 'Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour:', blanks: ['sober', 'vigilant', 'adversary', 'lion', 'devour'], decoys: ['ready', 'strong', 'enemy', 'bear', 'destroy', 'watchful'] },
  { ref: '1 John 4:8', text: 'He that loveth not knoweth not God; for God is love.', blanks: ['loveth', 'knoweth', 'love'], decoys: ['prayeth', 'seeth', 'light', 'truth', 'feareth'] },
  { ref: 'Genesis 1:1', text: 'In the beginning God created the heaven and the earth.', blanks: ['beginning', 'created', 'heaven', 'earth'], decoys: ['end', 'made', 'stars', 'sea', 'light', 'venue'] },
  { ref: 'Genesis 1:3', text: 'And God said, Let there be light: and there was light.', blanks: ['light'], decoys: ['music', 'water', 'life', 'peace'] },
  { ref: 'Genesis 2:18', text: 'And the LORD God said, It is not good that the man should be alone; I will make him an help meet for him.', blanks: ['good', 'alone', 'help'], decoys: ['right', 'hungry', 'friend', 'wife', 'lonely', 'two girlfriends'] },
  { ref: 'Exodus 20:3', text: 'Thou shalt have no other gods before me.', blanks: ['gods', 'before'], decoys: ['idols', 'biases', 'above', 'beside', 'girlfriends'] },
  { ref: 'Exodus 20:12', text: 'Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee.', blanks: ['Honour', 'father', 'mother', 'long'], decoys: ['Love', 'brother', 'sister', 'many', 'Obey', 'happy'] },
  { ref: 'Exodus 20:15', text: 'Thou shalt not steal.', blanks: ['steal'], decoys: ['lie', 'kill', 'scalp', 'covet'] },
  { ref: 'Joshua 1:9', text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', blanks: ['strong', 'courage', 'afraid', 'dismayed'], decoys: ['brave', 'heart', 'weary', 'alone', 'troubled', 'faith'] },
  { ref: 'Deuteronomy 31:6', text: 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.', blanks: ['courage', 'fail', 'forsake'], decoys: ['heart', 'leave', 'forget', 'strength', 'judge'] },
  { ref: 'Numbers 6:24', text: 'The LORD bless thee, and keep thee:', blanks: ['bless', 'keep'], decoys: ['love', 'save', 'guide', 'hold'] },
  { ref: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.', blanks: ['shepherd', 'want'], decoys: ['king', 'fear', 'rock', 'fall', 'bias'] },
  { ref: 'Psalm 23:4', text: 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.', blanks: ['valley', 'shadow', 'evil', 'rod', 'staff', 'comfort'], decoys: ['parking lot', 'darkness', 'demons', 'sword', 'shield', 'guide'] },
  { ref: 'Psalm 27:1', text: 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?', blanks: ['light', 'salvation', 'fear', 'strength'], decoys: ['song', 'shield', 'doubt', 'joy', 'lamp', 'peace'] },
  { ref: 'Psalm 30:5', text: 'For his anger endureth but a moment; in his favour is life: weeping may endure for a night, but joy cometh in the morning.', blanks: ['moment', 'weeping', 'night', 'joy', 'morning'], decoys: ['day', 'sorrow', 'week', 'peace', 'evening', 'song'] },
  { ref: 'Psalm 34:18', text: 'The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.', blanks: ['nigh', 'broken', 'contrite'], decoys: ['far', 'humble', 'heavy', 'weary', 'proud'] },
  { ref: 'Psalm 37:4', text: 'Delight thyself also in the LORD; and he shall give thee the desires of thine heart.', blanks: ['Delight', 'desires', 'heart'], decoys: ['Trust', 'wishes', 'soul', 'dreams', 'Rest'] },
  { ref: 'Psalm 46:10', text: 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.', blanks: ['still', 'know', 'exalted'], decoys: ['quiet', 'feel', 'praised', 'patient', 'known'] },
  { ref: 'Psalm 98:4', text: 'Make a joyful noise unto the LORD, all the earth: make a loud noise, and rejoice, and sing praise.', blanks: ['joyful', 'noise', 'loud', 'rejoice'], decoys: ['holy', 'song', 'sweet', 'dance', 'fanchant', 'quiet'] },
  { ref: 'Psalm 118:24', text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.', blanks: ['day', 'rejoice', 'glad'], decoys: ['night', 'sing', 'rest', 'joyful', 'concert'] },
  { ref: 'Psalm 119:105', text: 'Thy word is a lamp unto my feet, and a light unto my path.', blanks: ['word', 'lamp', 'feet', 'path'], decoys: ['song', 'lightstick', 'eyes', 'road', 'heart', 'spotlight'] },
  { ref: 'Psalm 133:1', text: 'Behold, how good and how pleasant it is for brethren to dwell together in unity!', blanks: ['pleasant', 'brethren', 'unity'], decoys: ['holy', 'fans', 'harmony', 'peace', 'sisters'] },
  { ref: 'Psalm 139:14', text: 'I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.', blanks: ['fearfully', 'wonderfully', 'marvellous', 'soul'], decoys: ['carefully', 'perfectly', 'glorious', 'heart', 'beautifully'] },
  { ref: 'Psalm 150:6', text: 'Let every thing that hath breath praise the LORD. Praise ye the LORD.', blanks: ['breath', 'praise'], decoys: ['life', 'voice', 'sing', 'thank'] },
  { ref: 'Proverbs 3:5', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.', blanks: ['Trust', 'heart', 'lean', 'understanding'], decoys: ['Hope', 'soul', 'rely', 'wisdom', 'strength', 'Rest'] },
  { ref: 'Proverbs 6:6', text: 'Go to the ant, thou sluggard; consider her ways, and be wise:', blanks: ['ant', 'sluggard', 'wise'], decoys: ['bee', 'fool', 'strong', 'lion', 'quick'] },
  { ref: 'Proverbs 12:22', text: 'Lying lips are abomination to the LORD: but they that deal truly are his delight.', blanks: ['Lying', 'abomination', 'truly', 'delight'], decoys: ['Deflecting', 'shame', 'kindly', 'joy', 'Proud'] },
  { ref: 'Proverbs 15:1', text: 'A soft answer turneth away wrath: but grievous words stir up anger.', blanks: ['soft', 'wrath', 'grievous', 'anger'], decoys: ['kind', 'enemies', 'harsh', 'strife', 'loud', 'trouble'] },
  { ref: 'Proverbs 16:9', text: 'A man\'s heart deviseth his way: but the LORD directeth his steps.', blanks: ['deviseth', 'way', 'directeth', 'steps'], decoys: ['chooseth', 'dash', 'guideth', 'path', 'moves', 'feet'] },
  { ref: 'Proverbs 16:18', text: 'Pride goeth before destruction, and an haughty spirit before a fall.', blanks: ['Pride', 'destruction', 'haughty', 'fall'], decoys: ['Greed', 'ruin', 'proud', 'shame', 'Fear', 'end'] },
  { ref: 'Proverbs 17:22', text: 'A merry heart doeth good like a medicine: but a broken spirit drieth the bones.', blanks: ['merry', 'medicine', 'broken', 'bones'], decoys: ['glad', 'sushi', 'heavy', 'soul', 'song'] },
  { ref: 'Proverbs 18:10', text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.', blanks: ['tower', 'righteous', 'safe'], decoys: ['rock', 'wise', 'free', 'fortress', 'faithful'] },
  { ref: 'Proverbs 22:6', text: 'Train up a child in the way he should go: and when he is old, he will not depart from it.', blanks: ['Train', 'child', 'old', 'depart'], decoys: ['Raise', 'baby', 'grown', 'forget', 'stray'] },
  { ref: 'Proverbs 27:17', text: 'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.', blanks: ['Iron', 'sharpeneth', 'friend'], decoys: ['Steel', 'brother', 'polisheth', 'Stone', 'enemy'] },
  { ref: 'Ecclesiastes 3:1', text: 'To every thing there is a season, and a time to every purpose under the heaven:', blanks: ['season', 'time', 'purpose', 'heaven'], decoys: ['reason', 'place', 'plan', 'sun', 'song', 'moment'] },
  { ref: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', blanks: ['wait', 'renew', 'strength', 'eagles', 'weary', 'faint'], decoys: ['call', 'restore', 'hope', 'doves', 'tired', 'fall'] },
  { ref: 'Isaiah 41:10', text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.', blanks: ['dismayed', 'strengthen', 'uphold', 'righteousness'], decoys: ['afraid', 'guide', 'carry', 'glory', 'protect', 'mercy'] },
  { ref: 'Isaiah 55:8', text: 'For my thoughts are not your thoughts, neither are your ways my ways, saith the LORD.', blanks: ['thoughts', 'ways'], decoys: ['plans', 'words', 'paths', 'songs'] },
  { ref: 'Lamentations 3:23', text: 'They are new every morning: great is thy faithfulness.', blanks: ['new', 'morning', 'faithfulness'], decoys: ['good', 'day', 'mercy', 'kindness', 'evening'] },
  { ref: 'Micah 6:8', text: 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?', blanks: ['justly', 'mercy', 'humbly'], decoys: ['rightly', 'peace', 'boldly', 'truth', 'quietly'] },
  { ref: 'Revelation 21:4', text: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.', blanks: ['tears', 'death', 'sorrow', 'crying', 'pain'], decoys: ['fear', 'night', 'demons', 'grief', 'hunger', 'concerts'] },
  { ref: 'Revelation 22:13', text: 'I am Alpha and Omega, the beginning and the end, the first and the last.', blanks: ['Alpha', 'Omega', 'beginning', 'first'], decoys: ['Beta', 'Delta', 'start', 'best', 'Sigma'] },
];

// Build a Bible Check question. level 1: one blank + 4 choices; level 2: two blanks
// answered in sequence; level 3: no multiple choice (type the missing word).
export function makeQuestion(rng, level) {
  const v = rng.pick(VERSES);
  const words = v.blanks.filter((w) => new RegExp('\\b' + w + '\\b').test(v.text));
  const pickN = level === 2 ? Math.min(2, words.length) : 1;
  let blanks = rng.shuffle(words.slice()).slice(0, pickN);
  if (level === 3) blanks = [words.slice().sort((a, b) => a.length - b.length).find((w) => w.length >= 3 && !w.includes(' ')) || words[0]];
  blanks.sort((a, b) => v.text.indexOf(a) - v.text.indexOf(b));
  const choices = blanks.map((ans) => {
    const pool = [...v.decoys, ...v.blanks].filter((d) => d.toLowerCase() !== ans.toLowerCase());
    const opts = rng.shuffle([...new Set(pool)]).slice(0, 3);
    return rng.shuffle([ans, ...opts]);
  });
  let display = v.text;
  for (const b of blanks) display = display.replace(new RegExp('\\b' + b + '\\b'), '_'.repeat(Math.max(4, b.length)));
  return { ref: v.ref, text: v.text, display, blanks, choices, level };
}

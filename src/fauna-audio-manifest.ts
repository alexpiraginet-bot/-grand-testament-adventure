import type {FaunaSoundClip} from './fauna-audio.ts';

export const FAUNA_AUDIO_CREDITS=[
  {author:'felix.blume',url:'https://freesound.org/people/felix.blume/sounds/157763/'},
  {author:'D4XX',url:'https://freesound.org/people/D4XX/sounds/607245/'},
  {author:'zachrau',url:'https://freesound.org/people/zachrau/sounds/362283/'},
  {author:'JKata',url:'https://freesound.org/people/JKata/sounds/626174/'},
  {author:'laughatlantic',url:'https://freesound.org/people/laughatlantic/sounds/528067/'},
] as const;

/** Optional, locally hosted CC0 recordings. Provenance and derivative hashes: /audio/fauna/SOURCES.json. */
export function faunaAudioManifest(base='/'):readonly FaunaSoundClip[] {
  const directory=`${base.endsWith('/')?base:`${base}/`}audio/fauna/`;
  return [
    {id:'chicken',kind:'chicken',url:`${directory}chicken.mp3`,gain:.16,radius:22},
    {id:'donkey',kind:'donkey',url:`${directory}donkey.mp3`,gain:.10,radius:55},
    {id:'sheep',kind:'sheep',url:`${directory}sheep.mp3`,gain:.12,radius:32},
    {id:'birds',kind:'birds',url:`${directory}birds.mp3`,gain:.20,radius:48},
    {id:'lake',kind:'lake',url:`${directory}lake.mp3`,gain:.20,radius:40},
  ];
}

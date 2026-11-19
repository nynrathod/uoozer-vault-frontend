import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useNoteEditor } from '../editor/NoteEditorProvider'
import { onUiEvent } from '../editor/uiEvents'

type Emoji = [char: string, name: string]

const GROUPS: { name: string; emojis: Emoji[] }[] = [
  {
    name: 'Smileys & emotion',
    emojis: [
      ['😀', 'grinning'],
      ['😃', 'smiley happy'],
      ['😄', 'laughing'],
      ['😁', 'beam grin'],
      ['😆', 'lol laugh'],
      ['😅', 'sweat laugh'],
      ['🤣', 'rofl rolling'],
      ['😂', 'joy tears laugh'],
      ['🙂', 'slight smile'],
      ['🙃', 'upside down'],
      ['😉', 'wink'],
      ['😊', 'blush smile'],
      ['😇', 'angel halo'],
      ['🥰', 'in love hearts'],
      ['😍', 'heart eyes'],
      ['🤩', 'star struck wow'],
      ['😘', 'kiss'],
      ['😋', 'yum tasty'],
      ['😜', 'wink tongue'],
      ['🤪', 'zany crazy'],
      ['🤨', 'eyebrow suspicious'],
      ['🧐', 'monocle inspect'],
      ['🤓', 'nerd glasses'],
      ['😎', 'cool sunglasses'],
      ['🥳', 'party celebrate'],
      ['😏', 'smirk'],
      ['😒', 'unamused meh'],
      ['😔', 'sad down'],
      ['😢', 'cry sad tear'],
      ['😭', 'sob cry loud'],
      ['😤', 'triumph steam'],
      ['😠', 'angry'],
      ['😡', 'rage mad'],
      ['🤯', 'mind blown'],
      ['😳', 'flushed blush'],
      ['🥺', 'pleading puppy'],
      ['😱', 'scream fear'],
      ['😴', 'sleep zzz'],
      ['🤔', 'thinking hmm'],
      ['🤫', 'shush quiet'],
      ['🤭', 'giggle hand'],
      ['😬', 'grimace awkward'],
      ['🙄', 'eye roll'],
      ['🤗', 'hug'],
      ['🤠', 'cowboy hat'],
      ['🤡', 'clown'],
      ['👻', 'ghost halloween'],
      ['💀', 'skull dead'],
      ['👽', 'alien ufo'],
      ['🤖', 'robot'],
      ['💩', 'poop'],
      ['😈', 'devil'],
      ['🥱', 'yawn tired'],
    ],
  },
  {
    name: 'People & gestures',
    emojis: [
      ['👋', 'wave hello'],
      ['🤚', 'raised hand'],
      ['✋', 'stop high five'],
      ['🖖', 'spock vulcan'],
      ['👌', 'ok perfect'],
      ['🤏', 'pinch small'],
      ['✌️', 'peace victory'],
      ['🤞', 'fingers crossed luck'],
      ['🤟', 'love you'],
      ['🤘', 'rock on'],
      ['🤙', 'call me shaka'],
      ['👈', 'point left'],
      ['👉', 'point right'],
      ['👆', 'point up'],
      ['👇', 'point down'],
      ['👍', 'thumbs up like'],
      ['👎', 'thumbs down dislike'],
      ['✊', 'fist'],
      ['👏', 'clap applause'],
      ['🙌', 'raised hands hooray'],
      ['🤝', 'handshake deal'],
      ['🙏', 'pray thanks please'],
      ['💪', 'muscle strong flex'],
      ['👀', 'eyes look watch'],
      ['🧠', 'brain smart'],
      ['👶', 'baby'],
      ['🙅', 'no cross'],
      ['🙆', 'yes ok'],
      ['💁', 'info person'],
      ['🙋', 'raising hand'],
      ['🤦', 'facepalm'],
      ['🤷', 'shrug whatever'],
      ['💃', 'dancing woman'],
      ['🕺', 'dancing man'],
      ['🚶', 'walking'],
      ['🏃', 'running'],
      ['🧘', 'yoga meditate'],
    ],
  },
  {
    name: 'Animals & nature',
    emojis: [
      ['🐶', 'dog puppy'],
      ['🐱', 'cat kitten'],
      ['🐭', 'mouse'],
      ['🐹', 'hamster'],
      ['🐰', 'rabbit bunny'],
      ['🦊', 'fox'],
      ['🐻', 'bear'],
      ['🐼', 'panda'],
      ['🐨', 'koala'],
      ['🐯', 'tiger'],
      ['🦁', 'lion'],
      ['🐮', 'cow'],
      ['🐷', 'pig'],
      ['🐸', 'frog'],
      ['🐵', 'monkey'],
      ['🐔', 'chicken'],
      ['🐧', 'penguin'],
      ['🐦', 'bird'],
      ['🦆', 'duck'],
      ['🦅', 'eagle'],
      ['🦉', 'owl'],
      ['🐺', 'wolf'],
      ['🐴', 'horse'],
      ['🦄', 'unicorn'],
      ['🐝', 'bee honey'],
      ['🦋', 'butterfly'],
      ['🐞', 'ladybug'],
      ['🐢', 'turtle'],
      ['🐍', 'snake'],
      ['🐙', 'octopus'],
      ['🐬', 'dolphin'],
      ['🐳', 'whale'],
      ['🦈', 'shark'],
      ['🐊', 'crocodile'],
      ['🐘', 'elephant'],
      ['🦒', 'giraffe'],
      ['🌵', 'cactus'],
      ['🌲', 'tree pine'],
      ['🌳', 'tree'],
      ['🌴', 'palm tree'],
      ['🌱', 'seedling grow'],
      ['🍀', 'clover luck'],
      ['🍁', 'maple leaf fall'],
      ['🍄', 'mushroom'],
      ['💐', 'bouquet flowers'],
      ['🌷', 'tulip'],
      ['🌹', 'rose love'],
      ['🌸', 'cherry blossom'],
      ['🌻', 'sunflower'],
      ['🌙', 'moon night'],
      ['⭐', 'star'],
      ['🌟', 'glowing star'],
      ['✨', 'sparkles shine'],
      ['⚡', 'lightning zap'],
      ['🔥', 'fire flame lit'],
      ['🌈', 'rainbow'],
      ['☀️', 'sun sunny'],
      ['❄️', 'snowflake cold'],
      ['💧', 'droplet water'],
    ],
  },
  {
    name: 'Food & drink',
    emojis: [
      ['🍎', 'apple'],
      ['🍊', 'orange tangerine'],
      ['🍋', 'lemon'],
      ['🍌', 'banana'],
      ['🍉', 'watermelon'],
      ['🍇', 'grapes'],
      ['🍓', 'strawberry'],
      ['🍒', 'cherries'],
      ['🍑', 'peach'],
      ['🥭', 'mango'],
      ['🍍', 'pineapple'],
      ['🥝', 'kiwi'],
      ['🍅', 'tomato'],
      ['🥑', 'avocado'],
      ['🥦', 'broccoli'],
      ['🥕', 'carrot'],
      ['🌽', 'corn'],
      ['🍞', 'bread'],
      ['🥐', 'croissant'],
      ['🥖', 'baguette bread'],
      ['🥨', 'pretzel'],
      ['🥞', 'pancakes'],
      ['🧇', 'waffle'],
      ['🧀', 'cheese'],
      ['🍗', 'chicken leg'],
      ['🥩', 'steak meat'],
      ['🍔', 'burger'],
      ['🍟', 'fries'],
      ['🍕', 'pizza slice'],
      ['🌭', 'hot dog'],
      ['🥪', 'sandwich'],
      ['🌮', 'taco'],
      ['🌯', 'burrito'],
      ['🥗', 'salad'],
      ['🍝', 'spaghetti pasta'],
      ['🍜', 'noodles ramen'],
      ['🍣', 'sushi'],
      ['🍤', 'shrimp tempura'],
      ['🍚', 'rice'],
      ['🍦', 'ice cream'],
      ['🍩', 'donut'],
      ['🍪', 'cookie'],
      ['🎂', 'birthday cake'],
      ['🍰', 'cake slice'],
      ['🍫', 'chocolate'],
      ['🍬', 'candy sweet'],
      ['🍭', 'lollipop'],
      ['🍿', 'popcorn'],
      ['☕', 'coffee'],
      ['🍵', 'tea matcha'],
      ['🧃', 'juice box'],
      ['🥤', 'soda cup straw'],
      ['🍺', 'beer'],
      ['🍷', 'wine glass'],
      ['🥛', 'milk glass'],
    ],
  },
  {
    name: 'Activity',
    emojis: [
      ['⚽', 'soccer football'],
      ['🏀', 'basketball'],
      ['🏈', 'american football'],
      ['⚾', 'baseball'],
      ['🎾', 'tennis'],
      ['🏐', 'volleyball'],
      ['🎱', 'pool billiards'],
      ['🏓', 'ping pong table tennis'],
      ['🏸', 'badminton'],
      ['🏒', 'hockey'],
      ['🥊', 'boxing glove'],
      ['⛸', 'ice skate'],
      ['🎿', 'ski'],
      ['🏂', 'snowboard'],
      ['🏋️', 'gym weightlift'],
      ['🤸', 'cartwheel flip'],
      ['🏌️', 'golf'],
      ['🏄', 'surfing'],
      ['🏊', 'swimming'],
      ['🚴', 'cycling bike'],
      ['🏆', 'trophy win champion'],
      ['🥇', 'gold medal first'],
      ['🎯', 'target dart bullseye'],
      ['🎲', 'dice game'],
      ['🎮', 'video game controller'],
      ['🧩', 'puzzle piece'],
      ['🎨', 'art palette paint'],
      ['🎬', 'movie clapper'],
      ['🎤', 'microphone sing'],
      ['🎧', 'headphones music'],
      ['🎸', 'guitar'],
      ['🎹', 'piano keyboard'],
      ['🎺', 'trumpet'],
      ['🎻', 'violin'],
      ['🥁', 'drum'],
    ],
  },
  {
    name: 'Objects & work',
    emojis: [
      ['⌚', 'watch time'],
      ['📱', 'phone mobile'],
      ['💻', 'laptop computer'],
      ['⌨️', 'keyboard typing'],
      ['🖥', 'desktop computer'],
      ['🖨', 'printer'],
      ['🖱', 'mouse computer'],
      ['💾', 'floppy save'],
      ['📷', 'camera photo'],
      ['📹', 'video camera'],
      ['🔍', 'search magnify'],
      ['💡', 'light bulb idea'],
      ['🔒', 'lock secure'],
      ['🔑', 'key'],
      ['🔨', 'hammer'],
      ['🛠', 'tools wrench'],
      ['🧰', 'toolbox'],
      ['🧲', 'magnet'],
      ['🔬', 'microscope science'],
      ['🔭', 'telescope space'],
      ['📡', 'satellite antenna'],
      ['💉', 'syringe shot vaccine'],
      ['💊', 'pill medicine'],
      ['📝', 'memo note write'],
      ['📚', 'books read'],
      ['📖', 'open book'],
      ['📎', 'paperclip'],
      ['📅', 'calendar date'],
      ['📊', 'bar chart data'],
      ['📈', 'chart up growth'],
      ['📉', 'chart down decline'],
      ['📋', 'clipboard list'],
      ['📌', 'pushpin pin'],
      ['✏️', 'pencil edit'],
      ['💼', 'briefcase work'],
      ['📁', 'folder files'],
      ['🗑', 'trash bin delete'],
      ['✉️', 'envelope mail'],
      ['📧', 'email'],
      ['📦', 'package box'],
      ['🏷', 'label tag'],
      ['🧾', 'receipt bill'],
      ['💰', 'money bag'],
      ['💳', 'credit card pay'],
      ['💎', 'gem diamond'],
      ['⏰', 'alarm clock'],
      ['⏳', 'hourglass time'],
      ['🗺', 'map travel'],
      ['🧭', 'compass'],
      ['🎁', 'gift present'],
      ['🎈', 'balloon party'],
      ['🎉', 'party popper celebrate'],
      ['🚀', 'rocket launch ship'],
      ['🛒', 'shopping cart'],
      ['👕', 'shirt tshirt'],
      ['👟', 'sneaker shoe'],
      ['🎒', 'backpack school'],
      ['👓', 'glasses'],
      ['☂️', 'umbrella rain'],
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      ['❤️', 'red heart love'],
      ['🧡', 'orange heart'],
      ['💛', 'yellow heart'],
      ['💚', 'green heart'],
      ['💙', 'blue heart'],
      ['💜', 'purple heart'],
      ['🖤', 'black heart'],
      ['🤍', 'white heart'],
      ['💯', 'hundred perfect score'],
      ['✅', 'check done yes'],
      ['❌', 'cross no wrong'],
      ['❗', 'exclamation important'],
      ['❓', 'question'],
      ['➕', 'plus add'],
      ['➖', 'minus'],
      ['✖️', 'multiply times'],
      ['➗', 'divide'],
      ['♻️', 'recycle'],
      ['⚠️', 'warning caution'],
      ['🚫', 'no prohibited'],
      ['☮️', 'peace'],
      ['💠', 'diamond dot'],
      ['🔔', 'bell notification'],
      ['🔕', 'bell off mute'],
      ['🔊', 'sound on'],
      ['⬆️', 'up arrow'],
      ['⬇️', 'down arrow'],
      ['⬅️', 'left arrow'],
      ['➡️', 'right arrow'],
      ['🔴', 'red circle'],
      ['🟠', 'orange circle'],
      ['🟡', 'yellow circle'],
      ['🟢', 'green circle'],
      ['🔵', 'blue circle'],
      ['🟣', 'purple circle'],
      ['⚫', 'black circle'],
      ['⚪', 'white circle'],
      ['🟩', 'green square'],
      ['🟦', 'blue square'],
      ['🟪', 'purple square'],
    ],
  },
]

const PICKER_WIDTH = 312
const PICKER_MAX_HEIGHT = 288

export function EmojiPicker() {
  const editor = useNoteEditor()
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  // The slash menu's "Emoji" command asks for the picker through the event
  // pipe; the picker pops up right at the caret.
  useEffect(() => {
    if (!editor) return
    return onUiEvent((event) => {
      if (event.type !== 'emoji.open') return
      try {
        if (editor.isDestroyed) return
        const coords = editor.view.coordsAtPos(editor.state.selection.from)
        setAnchor({ x: coords.left, y: coords.bottom })
        setQuery('')
      } catch {
        // Position unavailable (view gone); skip opening.
      }
    })
  }, [editor])

  // Outside click and Escape dismiss; scrolling would leave it detached from
  // the caret, so it closes too.
  useEffect(() => {
    if (!anchor) return
    const close = () => setAnchor(null)
    const onDocDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setAnchor(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setAnchor(null)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [anchor])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GROUPS
    return GROUPS.map((group) => ({
      name: group.name,
      emojis: group.emojis.filter(([, name]) => name.includes(q)),
    })).filter((group) => group.emojis.length > 0)
  }, [query])

  if (!editor || !anchor) return null

  const left = Math.max(
    8,
    Math.min(anchor.x - PICKER_WIDTH / 2, window.innerWidth - PICKER_WIDTH - 8)
  )
  const openUp = anchor.y + PICKER_MAX_HEIGHT + 96 > window.innerHeight
  const top = openUp ? Math.max(8, anchor.y - PICKER_MAX_HEIGHT - 46) : anchor.y + 8

  const insert = (char: string) => {
    try {
      editor.chain().focus().insertContent(char).run()
    } catch {
      // Editor recreating on note switch; the click is simply dropped.
    }
    setAnchor(null)
  }

  return (
    <div
      ref={rootRef}
      className="note-emoji"
      style={{ top, left }}
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="note-emoji-search">
        <Search className="text-muted-foreground h-3.5 w-3.5" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search emoji…"
          aria-label="Search emoji"
        />
      </div>
      <div className="note-emoji-groups">
        {filtered.length === 0 && (
          <p className="text-muted-foreground px-1 py-6 text-center text-[12px]">
            No matching emoji
          </p>
        )}
        {filtered.map((group) => (
          <div key={group.name}>
            <p className="note-emoji-group-title">{group.name}</p>
            <div className="note-emoji-grid">
              {group.emojis.map(([char, name]) => (
                <button
                  key={`${group.name}-${name}`}
                  type="button"
                  title={name}
                  aria-label={name}
                  className="note-emoji-item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insert(char)}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

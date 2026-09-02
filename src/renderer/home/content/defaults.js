function dateRange(y1, m1, d1, y2, m2, d2, name) {
  const out = {};
  const d = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (d <= end) {
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    out[key] = name;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* 2026 国务院法定节假日与调休（国办发明电）。仅作离线兜底：
 * 联网后由 holiday-cn（18-holiday-sync.js）按年自动同步官方数据并覆盖本表。 */
const BUILTIN_HOLIDAYS = Object.assign(
  dateRange(2026, 1, 1, 2026, 1, 3, '元旦'),
  dateRange(2026, 2, 15, 2026, 2, 23, '春节'),
  dateRange(2026, 4, 4, 2026, 4, 6, '清明节'),
  dateRange(2026, 5, 1, 2026, 5, 5, '劳动节'),
  dateRange(2026, 6, 19, 2026, 6, 21, '端午节'),
  dateRange(2026, 9, 25, 2026, 9, 27, '中秋节'),
  dateRange(2026, 10, 1, 2026, 10, 7, '国庆节')
);
const BUILTIN_MAKEUP = {
  '2026-01-04': '元旦', '2026-02-14': '春节', '2026-02-28': '春节',
  '2026-05-09': '劳动节', '2026-09-20': '国庆节', '2026-10-10': '国庆节'
};

const DEFAULT_SCHEDULES = {
  workday: [
    { name: '上午', start: '09:00', seq: [40, 10, 40] },
    { name: '下午', start: '14:00', seq: [40, 10, 40, 10, 40] },
    { name: '晚上', start: '20:00', seq: [40, 10, 40] }
  ],
  weekend: [
    { name: '上午', start: '09:00', seq: [40, 10, 40] },
    { name: '下午', start: '14:00', seq: [40, 10, 40, 10, 40] },
    { name: '晚上', start: '20:00', seq: [40, 10, 40] }
  ],
  holiday: [
    { name: '上午', start: '09:00', seq: [40, 10, 40] },
    { name: '下午', start: '14:00', seq: [40, 10, 40, 10, 40] },
    { name: '晚上', start: '20:00', seq: [40, 10, 40] }
  ]
};

const DEFAULT_QUOTES = {
  morningFirst: [
    '又开始新的一天了，祝你活力满满开启今天的学习吧！',
    '早上好！不用急，先坐下来，就赢了一半。',
    '晨光正好，把最清醒的时间留给最难的事吧。',
    '新的一天开始啦，深呼吸，我们慢慢进入状态。',
    '早安！今天也请温柔而坚定地对待自己。',
    '一天之计在于晨，先从这一小时开始。',
    '早安！昨天的努力都算数，今天继续。',
    '太阳都起床了，我们也开始吧。'
  ],
  afternoonFirst: [
    '午休结束，下午的战斗开始啦！',
    '下午好！伸展一下肩膀，喝口水，我们继续。',
    '没睡够也没关系，先开始，状态会跟上的。',
    '下午的时光也很珍贵，慢慢来，比较快。',
    '下午好！把上午的劲儿接着用。',
    '又是元气满满的下午，冲呀。',
    '午后的困意是纸老虎，学五分钟它就跑了。',
    '下午好！专注当下这一块就好。'
  ],
  eveningFirst: [
    '晚上好！最后一段冲刺，今天的努力马上就要兑现了。',
    '晚间时段开始啦，安静的环境最适合静下心来。',
    '晚上好！今晚认真学完，就能安心休息啦。',
    '最后一程了，稳住节奏，不求快但求专注。',
    '夜晚是沉下心的好时候，开始吧。',
    '晚上好！离今天的目标又近了一步。',
    '华灯初上，正好静心学习。',
    '晚上好！坚持到现在已经很棒了。'
  ],
  study: [
    '别想有多远，先做好这四十分钟。',
    '坐下来，打开材料，剩下的交给时间。',
    '这四十分钟只属于眼前这一件事。',
    '走神了就回来，每一次拉回来都是练习。',
    '心流不挑时间，只挑开始的人。',
    '不着急，先把这一块啃下来。',
    '现在做的事，是未来的你在感谢现在的你。',
    '专注不是天赋，是一次一次回到当下的练习。',
    '学习的复利，就藏在每一个安静的四十分钟里。',
    '别怕慢，就怕站。继续。',
    '少即是多，此刻只做一件事。',
    '当你觉得难的时候，正是大脑在生长的时候。'
  ],
  break: [
    '起身活动一下，看看远处，让眼睛也休息休息。',
    '离开座位走两步，倒杯水，回来更清醒。',
    '休息不是偷懒，大脑正在后台整理刚才学的东西。',
    '站起来伸个懒腰吧，待会儿见。',
    '别刷手机哦，望望窗外发发呆就很好。',
    '去窗边站一会儿，换个视角。',
    '喝口水，深呼吸三次，再回来。',
    '让眼睛离开屏幕，看看五米外的世界。',
    '十分钟很短，刚好够身体松一口气。',
    '揉揉肩膀转转脖子，身体也要照顾好。',
    '什么都不做也没关系，发呆也是一种恢复。',
    '站起来的这一分钟，就是给接下来充的电。'
  ],
  extraStart: [
    '计划之外，你又为自己留出了一段专注时间。',
    '多走这一段，不是必须，但很值得。',
    '愿意为目标再加一点时间，已经很了不起。',
    '今天的学习还想再延长一点，慢慢来，认真做完它。',
    '这是你额外送给自己的时间，专心用好这一段吧。',
    '不在计划里的坚持，也同样算数。'
  ],
  extraEnd: [
    '这段额外的努力也稳稳完成了，辛苦你。',
    '加钟收工，今天多做的这一点也值得记住。',
    '临时加的一段，也被你认真走完了。',
    '多出来的这段时间，你没有辜负它。',
    '今天已经完成了计划之外的一步，做得很好。',
    '额外的专注顺利结束，接下来好好休息吧。'
  ],
  sessionEnd: [
    '{session}的学习完成啦，辛苦了！',
    '干得漂亮，{session}告一段落！',
    '{session}结束！为坚持到现在的自己鼓个掌。',
    '又一个{session}顺利完成，你比昨天更强了。',
    '{session}收工！记得让大脑放空一会儿。',
    '恭喜，{session}的目标达成！'
  ],
  dayDone: [
    '今天全部完成！睡前可以花十分钟回想一下今天学的内容。',
    '今日份的努力已交付，好好休息，明天见。',
    '全部完成！学习之后的休息才是巩固记忆的一部分。',
    '辛苦一天了，合上书，给自己一个赞。',
    '今天的句号画得很圆满，晚安。',
    '完成！记得夸夸今天没有放弃的自己。'
  ]
};

const DEFAULT_QUOTES_EN = {
  morningFirst: [
    "A new day begins — here's to a focused, energetic start!",
    "Good morning! No rush — just sitting down is half the win.",
    "Morning light is perfect for the hardest task on your list.",
    "A fresh start — take a breath and ease into it.",
    "Good morning! Be gentle but firm with yourself today.",
    "The morning sets the tone — start with this hour.",
    "Good morning! Yesterday's effort counts. Keep going.",
    "The sun is up — let's begin."
  ],
  afternoonFirst: [
    "Break's over — the afternoon battle begins!",
    "Good afternoon! Stretch, sip some water, and continue.",
    "A bit groggy? Start anyway — focus will follow.",
    "Afternoon hours count too. Slow and steady.",
    "Good afternoon! Carry the morning's momentum.",
    "Another powered-up afternoon — let's go.",
    "The post-lunch slump is a paper tiger — it flees after five minutes.",
    "Good afternoon! Just this one block at a time."
  ],
  eveningFirst: [
    "Evening! Final sprint — today's effort is about to pay off.",
    "The quiet evening is perfect for deep focus. Begin.",
    "Evening! Finish strong and you can rest with a clear mind.",
    "Last stretch — steady rhythm, focus over speed.",
    "Night is a great time to settle in. Start now.",
    "Evening! One step closer to today's goal.",
    "City lights on — a fine time to study.",
    "Evening! Making it this far is already admirable."
  ],
  study: [
    "Don't think about how far — just these forty minutes.",
    "Sit down, open your materials, let time do the rest.",
    "These forty minutes belong to one thing only.",
    "Mind wandered? Bring it back — every return is practice.",
    "Flow doesn't pick a time; it picks a starter.",
    "No hurry — chew through this block first.",
    "What you do now is a gift to your future self.",
    "Focus isn't a gift; it's practice in returning, again and again.",
    "The compound interest of learning hides in every quiet forty minutes.",
    "Slow is fine. Stopping is the only problem. Continue.",
    "Less is more — one thing, right now.",
    "When it feels hard, your brain is growing."
  ],
  break: [
    "Stand up, stretch, and rest your eyes on something far away.",
    "Take a short walk, pour some water — you'll come back clearer.",
    "Resting isn't slacking; your brain is filing what you just learned.",
    "Stand up and stretch — see you in ten.",
    "Skip the feed; gazing out the window works better.",
    "By the window, a minute of daydreaming is fine.",
    "Sip water, take three deep breaths, then return.",
    "Look away from the screen at something five meters away.",
    "Ten minutes — just enough for your body to breathe.",
    "Rub your shoulders, roll your neck — care for your body too.",
    "Doing nothing is fine; daydreaming restores too.",
    "Standing up for this minute recharges the next forty."
  ],
  extraStart: [
    "You made room for one more focused stretch.",
    "Not required, but worth it.",
    "Choosing to give this a little more time is already something to be proud of.",
    "Take this extra stretch slowly and give it your full attention.",
    "This extra time is a gift to your future self.",
    "It wasn't on the plan, but it still counts."
  ],
  extraEnd: [
    "That extra stretch is complete — well done.",
    "Extra session wrapped. This effort counts too.",
    "You gave this added time your full attention. Nice work.",
    "One more focused stretch, finished.",
    "You went beyond the plan today. Be proud of that.",
    "Extra focus complete — now let yourself rest."
  ],
  sessionEnd: [
    "The {session} session is done — well done!",
    "Nice work — {session} wrapped up!",
    "{session} finished! Give yourself a hand.",
    "Another {session} complete — you're stronger than yesterday.",
    "{session} wrapped! Let your mind idle a bit.",
    "Congrats — {session} goal achieved!"
  ],
  dayDone: [
    "All done for today! Spend ten minutes tonight recalling what you learned.",
    "Today's effort is delivered. Rest well — see you tomorrow.",
    "Complete! Rest after learning is part of consolidating memory.",
    "A full day's work — close the books and applaud yourself.",
    "A perfect full stop for today. Good night.",
    "Done! Remember to praise the you who didn't give up."
  ]
};

const EN_DEFAULT_SCHEDULES = {
  workday: [
    { name: 'Morning', start: '09:00', seq: [40, 10, 40] },
    { name: 'Afternoon', start: '14:00', seq: [40, 10, 40, 10, 40] },
    { name: 'Evening', start: '20:00', seq: [40, 10, 40] }
  ],
  weekend: [
    { name: 'Morning', start: '09:00', seq: [40, 10, 40] },
    { name: 'Afternoon', start: '14:00', seq: [40, 10, 40, 10, 40] },
    { name: 'Evening', start: '20:00', seq: [40, 10, 40] }
  ],
  holiday: [
    { name: 'Morning', start: '09:00', seq: [40, 10, 40] },
    { name: 'Afternoon', start: '14:00', seq: [40, 10, 40, 10, 40] },
    { name: 'Evening', start: '20:00', seq: [40, 10, 40] }
  ]
};

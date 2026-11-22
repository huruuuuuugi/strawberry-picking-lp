// JSが動いている目印。CSSはこれがあるときだけ「登場前に隠す」
document.documentElement.classList.add('js');

// ---------------------------------------------
// 2つのいちご：タブの切り替え
// ---------------------------------------------
const tabs = document.querySelectorAll('.variety__tab');

function selectTab(tab) {
  tabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1; // 矢印キーで移動するので、Tabで止まるのは選択中だけ
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  });
}

// JSが動くときだけタブを出し、選択中のパネル以外を隠す
document.querySelector('.variety__tabs').hidden = false;
selectTab(tabs[0]);

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  // ←→キーで隣のタブへ
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

// ---------------------------------------------
// FV：「紅派はこっち」「白派はこっち」を押したら、そのタブを開いておく
// （スクロール自体はリンク #variety に任せる）
// ---------------------------------------------
document.querySelectorAll('.fv__label[data-tab]').forEach((label) => {
  label.addEventListener('click', () => {
    selectTab(document.getElementById(`tab-${label.dataset.tab}`));
  });
});

// ---------------------------------------------
// 料金・期間：空き状況カレンダー（2週間ずつ表示）
// ※空き状況は仮のデータ。本番では予約システムから取得する想定
// ---------------------------------------------
const STATUS = {
  ok:   { cls: 'calendar__mark--ok',   label: '空きあり' },
  few:  { cls: 'calendar__mark--few',  label: '残りわずか' },
  full: { cls: 'calendar__mark--full', label: '満席' },
};
// 3/1〜3/14 はデザインどおり。それ以降は仮のパターンをくり返す
const FIRST_TWO_WEEKS = ['ok','ok','ok','ok','few','ok','full', 'full','ok','few','few','few','ok','full'];

const PERIOD_START = new Date(2027, 2, 1);  // 2027/3/1（月）。月は0始まりなので 2 = 3月
const PERIOD_END   = new Date(2027, 3, 30); // 2027/4/30
const DAY = 24 * 60 * 60 * 1000;

const calBody  = document.getElementById('calendar-body');
const calMonth = document.getElementById('calendar-month');
const calPrev  = document.getElementById('calendar-prev');
const calNext  = document.getElementById('calendar-next');
let page = 0; // 0ページ目 = 3/1〜3/14

function statusOf(date) {
  const i = Math.round((date - PERIOD_START) / DAY);
  return FIRST_TWO_WEEKS[i % FIRST_TWO_WEEKS.length];
}

function renderCalendar() {
  const start = new Date(PERIOD_START.getTime() + page * 14 * DAY);
  const months = new Set();
  calBody.innerHTML = '';

  for (let w = 0; w < 2; w++) {
    const tr = document.createElement('tr');
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY);
      const td = document.createElement('td');
      td.textContent = date.getDate();

      if (date > PERIOD_END) {
        td.className = 'is-out';
        td.setAttribute('aria-label', `${date.getMonth() + 1}月${date.getDate()}日 期間外`);
      } else {
        months.add(date.getMonth() + 1);
        const s = STATUS[statusOf(date)];
        const mark = document.createElement('span');
        mark.className = `calendar__mark ${s.cls}`;
        mark.setAttribute('aria-hidden', 'true'); // 記号は読み上げず、下の aria-label で伝える
        td.append(mark);
        td.setAttribute('aria-label', `${date.getMonth() + 1}月${date.getDate()}日 ${s.label}`);
      }
      tr.append(td);
    }
    calBody.append(tr);
  }

  calMonth.textContent = `2027年${[...months].join('・')}月`;
  calPrev.disabled = page === 0;
  calNext.disabled = new Date(start.getTime() + 14 * DAY) > PERIOD_END;
}

document.querySelector('.calendar__nav').hidden = false; // JSが動くときだけ矢印を出す
calPrev.addEventListener('click', () => { page--; renderCalendar(); });
calNext.addEventListener('click', () => { page++; renderCalendar(); });
renderCalendar();

// ---------------------------------------------
// スクロールで要素がポップに登場する
// 画面に入ったら .is-in をつけ、CSSのアニメーションを再生する
// ---------------------------------------------
// 料金・カレンダー・アクセス・FAQは「比べる・確かめる」情報なので動かさず、最初から表示する
const REVEALS = {
  '.heading': '',
  '.variety__tabs': '',
  '.enjoy__bubble': 'pop',
  '.enjoy__photo': 'zoom',
  '.cta__ttl': 'pop',
  '.cta__note': '',
  '.cta__buttons': '',
};

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    observer.unobserve(entry.target); // 1回登場したら、もう見張らない
  });
}, { rootMargin: '0px 0px -10% 0px' }); // 画面の下から10%入ったところで登場

Object.entries(REVEALS).forEach(([selector, type]) => {
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.add('reveal');
    if (type) el.classList.add(`reveal--${type}`);

    // 同じ親の中に同じ種類が並ぶとき（FAQなど）は、0.1秒ずつずらして順番に出す
    const siblings = [...el.parentElement.children].filter((c) => c.matches(selector));
    el.style.setProperty('--delay', `${siblings.indexOf(el) * 0.1}s`);

    revealObserver.observe(el);
  });
});

// ---------------------------------------------
// よくあるご質問：なめらかに開閉する
// <details> は本来パッと開閉するので、クリックを横取りして
// 高さをアニメーションさせてから open を切り替える。
// （CSSだけで高さ auto をアニメーションする方法は、iPhoneのSafariが未対応のためJSで行う）
// ---------------------------------------------
const faqItems = document.querySelectorAll('.faq__item');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function animateFaq(item, willOpen) {
  const summary = item.querySelector('.faq__q');
  const border = item.offsetHeight - item.clientHeight; // 上下の枠線の太さ
  const startHeight = item.offsetHeight;                 // 今の高さ（動いている途中でもOK）

  item.anim?.cancel(); // 動いている途中でまた押されたら、前の動きを止める
  item.classList.toggle('is-closing', !willOpen);

  if (reduceMotion.matches) { // 動きを減らす設定なら、すぐ切り替える
    item.open = willOpen;
    item.classList.remove('is-closing');
    return;
  }

  item.open = true; // 開くときも閉じるときも、動いている間は中身を見せておく
  const endHeight = willOpen ? item.offsetHeight : summary.offsetHeight + border;

  item.anim = item.animate(
    [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
    { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' }
  );
  item.anim.onfinish = () => {
    item.open = willOpen;
    item.classList.remove('is-closing');
    item.anim = null;
  };
}

faqItems.forEach((item) => {
  item.querySelector('.faq__q').addEventListener('click', (e) => {
    e.preventDefault(); // ブラウザ標準の「パッと開閉」を止める
    const willOpen = !item.open || item.classList.contains('is-closing');

    // 1つ開いたら、ほかの開いている質問は閉じる
    if (willOpen) {
      faqItems.forEach((other) => {
        if (other !== item && other.open && !other.classList.contains('is-closing')) animateFaq(other, false);
      });
    }
    animateFaq(item, willOpen);
  });
});

const BASE = import.meta.env.BASE_URL ?? '/';

export function showHelp() {
  if (document.getElementById('upf-help-overlay')) return; // already open

  const overlay = document.createElement('div');
  overlay.id = 'upf-help-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '600',
    background: 'rgba(3,3,28,0.97)',
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    overflowY: 'auto', fontFamily: 'monospace',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    background: '#05051e', border: '1px solid #00ffee33',
    maxWidth: '840px', width: '90%', margin: '32px auto',
    padding: '32px 36px 40px', color: '#aabbcc',
    position: 'relative',
  });
  overlay.appendChild(panel);

  const remove = () => overlay.remove();

  // Escape key closes
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', e => { if (e.target === overlay) { remove(); document.removeEventListener('keydown', onKey); } });

  // Banner
  const shield = document.createElement('img');
  shield.src = `${BASE}brand/upf_banner_main.jpg`;
  Object.assign(shield.style, {
    display: 'block', width: '100%', maxWidth: '630px', margin: '0 auto 28px',
  });
  panel.appendChild(shield);

  const section = (title: string) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      color: '#00ffee', fontSize: '12px', letterSpacing: '3px',
      textTransform: 'uppercase', marginTop: '28px', marginBottom: '10px',
      borderBottom: '1px solid #00ffee22', paddingBottom: '6px',
    });
    el.textContent = title;
    panel.appendChild(el);
  };

  const para = (text: string) => {
    const el = document.createElement('p');
    Object.assign(el.style, {
      fontSize: '13px', lineHeight: '1.8', color: '#889aaa',
      marginBottom: '10px',
    });
    el.textContent = text;
    panel.appendChild(el);
  };

  const bullets = (items: string[]) => {
    const ul = document.createElement('ul');
    Object.assign(ul.style, { paddingLeft: '20px', marginBottom: '10px' });
    for (const item of items) {
      const li = document.createElement('li');
      Object.assign(li.style, { fontSize: '13px', lineHeight: '1.8', color: '#889aaa', marginBottom: '4px' });
      li.textContent = item;
      ul.appendChild(li);
    }
    panel.appendChild(ul);
  };

  const keyRow = (key: string, desc: string) => {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '13px' });
    const k = document.createElement('span');
    Object.assign(k.style, { color: '#00ffee', minWidth: '80px', fontWeight: 'bold' });
    k.textContent = key;
    const d = document.createElement('span');
    d.style.color = '#889aaa';
    d.textContent = desc;
    row.appendChild(k); row.appendChild(d);
    panel.appendChild(row);
  };

  // ── Content ──────────────────────────────────────────────────────────────────

  section('The Game');
  para('Ultimate Penny Football is derived from a classic game played with three coins, Penny Football. That game sucks because it is not a computer game.');

  section('Common Rules');
  bullets([
    'Kickoff — kick a green coin to hit a blue coin for a legal kickoff.',
    'Play-on — kick a green coin between the other two coins for a legal kick.',
    'Hitting a sink object or a coin going off the field is a fault.',
    'Any coin passing through the goal line on a legal kick is a goal.',
  ]);

  section('Coin Colours');
  bullets([
    'Green — good to kick.',
    'Blue — good to pass through.',
    'Red — kicked coin, not yet intersected the other coins.',
    'Yellow — coin ready to kick, but currently opponent\'s play.',
  ]);

  section('Match Play (two player on fields)');
  para('When playing a match you each have your own goal on either side of the field. Play swaps player each time there is a fault or a goal.');
  para('If playing locally the field spins around as player swaps so the goal is always at the top of screen.');
  para('When logged in and paired you will play two player online. The field no longer spins as your opponent will be seeing the field spun around. When the coins are green they are ready for you to kick. If a coin is yellow — it is ready to be kicked but not your turn.');

  section('Challenge Play (single player on a course)');
  para('Choosing a course level puts you in single player mode. There is only one goal on the course.');
  para('When the player faults the fault count is increased. Each course has a maximum number of faults (its par). Complete the game in less faults than par and you win.');
  para('Leaderboard will come in the future — where the least faults to complete a level put you in the lead. Where there is a tie on the number of faults, the fastest run wins.');

  section('Playing Online');
  bullets([
    'Click the Online button to log in.',
    'Choose a unique username from the dialog.',
    'If there are other people logged in, you can choose to pair with one on the list.',
    'The paired person needs to agree to complete the pairing.',
    'Once paired, any two player levels started by either player will be online-networked.',
    'You can unpair by clicking on the same button.',
  ]);

  section('Controls');
  keyRow('Drag', 'Pull a coin back then release to kick.');
  keyRow('Esc', 'Pause — option to return to menu.');
  keyRow('Backspace', 'Reset to kickoff position (counts as a fault in courses).');
  keyRow('Tab', 'Toggle boundary/obstacle overlay on top of level artwork.');

  // ── Close button ─────────────────────────────────────────────────────────────
  const close = document.createElement('button');
  Object.assign(close.style, {
    display: 'block', margin: '36px auto 0',
    background: 'transparent', border: '1px solid #446688',
    color: '#446688', fontFamily: 'monospace', fontSize: '13px',
    padding: '8px 32px', cursor: 'pointer', letterSpacing: '2px',
  });
  close.textContent = 'CLOSE';
  close.addEventListener('click', () => { remove(); document.removeEventListener('keydown', onKey); });
  panel.appendChild(close);

  // ── Version / attribution (top-right) ────────────────────────────────────
  const meta = document.createElement('div');
  Object.assign(meta.style, {
    position: 'absolute', bottom: '40px', right: '36px',
    textAlign: 'right', fontSize: '11px', color: '#00ffee',
    lineHeight: '1.8', opacity: '0.7',
  });
  meta.innerHTML = 'Version 0.2 &nbsp;·&nbsp; 2026-04-05<br>rangi.sutton@gmail.com';
  panel.appendChild(meta);

  document.body.appendChild(overlay);
}

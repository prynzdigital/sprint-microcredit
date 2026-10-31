/* Sprint Micro-Credit — site interactions. Vanilla JS, no dependencies.
   Each feature initialises only when its data-* hook is present on the page. */
(() => {
  'use strict';

  const CFG = window.SPRINT || { calc: { min: 500, max: 20000, step: 100, defaultAmount: 3000, minMonths: 1, maxMonths: 12, defaultMonths: 6, monthlyRatePct: 5 }, whatsapp: '233592111441', email: 'info@sprintmicrocredit.com' };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const cedi = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 });
  const cedi2 = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Whole cedis when there are no pesewas, otherwise two decimals (e.g. GH₵270 but GH₵22.50)
  const money = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? cedi.format(Math.round(v)) : cedi2.format(v));
  const num = (v) => { const n = parseFloat(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const months = (n) => `${n} month${n === 1 ? '' : 's'}`;
  const waUrl = (text) => `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(text)}`;
  const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const setPct = (el, pct) => el && el.style.setProperty('--p', `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`);

  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function paintRange(r) {
    const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty('--pct', `${pct}%`);
  }

  // Shared loan maths ------------------------------------------------------
  const Loan = {
    flat(P, ratePct, n) {
      const interest = P * (ratePct / 100) * n;
      return { monthly: (P + interest) / n, interest, total: P + interest };
    },
    reducing(P, ratePct, n) {
      const r = ratePct / 100;
      const monthly = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
      return { monthly, interest: monthly * n - P, total: monthly * n };
    },
    flatSchedule(P, ratePct, n) {
      const { monthly } = Loan.flat(P, ratePct, n);
      const principalPart = P / n, interestPart = P * (ratePct / 100);
      let bal = P;
      return Array.from({ length: n }, (_, i) => { bal -= principalPart; return { m: i + 1, pay: monthly, principal: principalPart, interest: interestPart, bal: Math.max(0, bal) }; });
    },
  };

  // Header & navigation ------------------------------------------------------
  function initNav() {
    const header = $('[data-header]');
    const toggle = $('[data-nav-toggle]');
    const nav = $('#site-nav');
    if (header) {
      const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
      onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    }
    if (!toggle || !nav) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.append(backdrop);
    const set = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
      backdrop.classList.toggle('show', open);
      document.body.classList.toggle('nav-open', open);
      if (open) $('a', nav)?.focus();
    };
    toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
    backdrop.addEventListener('click', () => set(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); toggle.focus(); } });
    $$('a', nav).forEach((a) => a.addEventListener('click', () => set(false)));
  }

  // Promotional top bar: rotate offers, pause on hover/focus, dismiss for this visit
  function initPromo(bar) {
    try { if (sessionStorage.getItem('sprint-promo-hidden') === '1') { bar.hidden = true; return; } } catch { /* storage blocked */ }
    $('[data-promo-close]', bar)?.addEventListener('click', () => {
      bar.hidden = true;
      try { sessionStorage.setItem('sprint-promo-hidden', '1'); } catch { /* storage blocked */ }
    });
    const items = $$('.promo-item', bar);
    // Only the visible offer is reachable by keyboard / screen readers
    const sync = () => items.forEach((el) => {
      const on = el.classList.contains('is-active');
      el.tabIndex = on ? 0 : -1;
      el.setAttribute('aria-hidden', String(!on));
    });
    sync();
    if (items.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0, paused = false;
    bar.addEventListener('mouseenter', () => (paused = true));
    bar.addEventListener('mouseleave', () => (paused = false));
    bar.addEventListener('focusin', () => (paused = true));
    bar.addEventListener('focusout', () => (paused = false));
    setInterval(() => {
      if (paused || document.hidden) return;
      const cur = items[i];
      i = (i + 1) % items.length;
      cur.classList.remove('is-active');
      cur.classList.add('is-leaving');
      setTimeout(() => cur.classList.remove('is-leaving'), 500);
      items[i].classList.add('is-active');
      sync();
    }, 4500);
  }

  // Scroll reveal & count-up --------------------------------------------------
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in'); io.unobserve(el);
      // Drop the reveal classes once the entrance is done, so hover transforms aren't overridden.
      setTimeout(() => el.classList.remove('reveal', 'in'), 1100);
    }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));

    const counters = $$('[data-count]');
    const cio = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, target = num(el.dataset.count), suffix = el.dataset.suffix || '';
      const start = performance.now(), dur = 1200;
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-GH') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick); cio.unobserve(el);
    }), { threshold: .6 });
    counters.forEach((c) => cio.observe(c));
  }

  // Loan calculator -----------------------------------------------------------
  function initCalculator(root) {
    const c = CFG.calc;
    const amount = $('[data-amount]', root), term = $('[data-months]', root), salary = $('[data-salary]', root);
    const out = (k) => $(`[data-out="${k}"]`, root);
    const params = new URLSearchParams(location.search);

    Object.assign(amount, { min: c.min, max: c.max, step: c.step, value: clamp(num(params.get('amount')) || c.defaultAmount, c.min, c.max) });
    Object.assign(term, { min: c.minMonths, max: c.maxMonths, step: 1, value: clamp(num(params.get('months')) || c.defaultMonths, c.minMonths, c.maxMonths) });
    $$('[data-out="min"]', root).forEach((e) => (e.textContent = cedi.format(c.min)));
    $$('[data-out="max"]', root).forEach((e) => (e.textContent = cedi.format(c.max)));
    $$('[data-out="rate"]', root).forEach((e) => (e.textContent = `${c.monthlyRatePct}%`));

    function update() {
      const P = num(amount.value), n = num(term.value);
      const r = Loan.flat(P, c.monthlyRatePct, n);
      [amount, term].forEach(paintRange);
      out('amount').textContent = cedi.format(P);
      out('months').textContent = months(n);
      out('monthly').textContent = cedi2.format(r.monthly);
      out('interest') && (out('interest').textContent = cedi2.format(r.interest));
      out('total') && (out('total').textContent = cedi2.format(r.total));
      out('principal') && (out('principal').textContent = cedi2.format(P));
      out('months-n') && (out('months-n').textContent = n);
      const donut = $('[data-donut]', root);
      if (donut) {
        setPct(donut, (P / r.total) * 100);
        donut.setAttribute('aria-label', `${Math.round((P / r.total) * 100)}% of what you repay is the amount you receive; ${Math.round((r.interest / r.total) * 100)}% is interest`);
      }
      const apply = $('[data-apply-link]', root);
      if (apply) apply.href = `/apply/?amount=${P}&months=${n}`;

      const meter = $('[data-meter]', root);
      if (meter && salary) {
        const s = num(salary.value);
        const fill = $('.meter-fill', meter), msg = $('.meter-msg', meter);
        if (!s) {
          meter.dataset.level = 'ok'; fill.style.width = '0'; msg.textContent = 'Enter your monthly take-home pay to check affordability.';
        } else {
          const pct = (r.monthly / s) * 100;
          fill.style.width = `${Math.min(100, pct)}%`;
          const okPct = c.affordComfortablePct || 30, warnPct = c.affordStretchPct || 40;
          meter.dataset.level = pct <= okPct ? 'ok' : pct <= warnPct ? 'warn' : 'bad';
          msg.textContent = pct <= okPct
            ? `Comfortable: this repayment is ${pct.toFixed(0)}% of your take-home pay.`
            : pct <= warnPct
              ? `Stretching: ${pct.toFixed(0)}% of your take-home pay. Consider a longer period or a smaller amount.`
              : `Too heavy: ${pct.toFixed(0)}% of your take-home pay. We recommend keeping repayments under ${okPct}%.`;
        }
      }

      document.dispatchEvent(new CustomEvent('sprint:loan', { detail: { P, n, monthly: r.monthly } }));
    }
    [amount, term, salary].forEach((el) => el && el.addEventListener('input', update));
    $$('[data-preset]', root).forEach((b) => b.addEventListener('click', () => { amount.value = b.dataset.preset; update(); }));
    update();
  }

  // Repayment plan dashboard (calculator page), driven by the calculator's sprint:loan event.
  function initPlan(root) {
    const c = CFG.calc;
    const body = $('tbody', root), summary = $('[data-out="summary"]', root), chart = $('.bars-chart', root);
    const terms = $('[data-terms]', root), apply = $('[data-plan-apply]', root);
    const k = (name) => $(`[data-k="${name}"]`, root);
    const termInput = $('[data-calc] [data-months]');
    // A spread of periods across the allowed range, always including both ends
    const periods = [...new Set([1, 3, 6, 9, 12].map((m) => clamp(m, c.minMonths, c.maxMonths)))];

    terms.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-n]');
      if (!btn || !termInput) return;
      termInput.value = btn.dataset.n;
      termInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    document.addEventListener('sprint:loan', ({ detail: { P, n, monthly } }) => {
      const r = Loan.flat(P, c.monthlyRatePct, n);
      summary.textContent = `${cedi.format(P)} over ${months(n)}`;
      k('monthly').textContent = cedi2.format(monthly);
      k('interest').textContent = money(r.interest);
      k('total').textContent = money(r.total);
      k('per100').textContent = cedi2.format((r.interest / P) * 100);
      if (apply) apply.href = `/apply/?amount=${P}&months=${n}`;

      const rows = Loan.flatSchedule(P, c.monthlyRatePct, n);
      // Bar heights = balance still owed at the start of each month
      chart.innerHTML = rows.map((row) => {
        const before = row.bal + row.principal;
        return `<span style="--h:${((before / P) * 100).toFixed(1)}%" title="Month ${row.m}: ${cedi.format(before)} owed"><b>${row.m}</b></span>`;
      }).join('');

      const options = [...new Set([...periods, n])].sort((a, b) => a - b).map((m) => ({ m, ...Loan.flat(P, c.monthlyRatePct, m) }));
      const maxTotal = Math.max(...options.map((o) => o.total));
      terms.innerHTML = options.map((o) => `
        <button type="button" class="term" data-n="${o.m}" aria-pressed="${o.m === n}">
          <span class="term-m">${months(o.m)}</span>
          <span class="term-bar"><i style="width:${((o.total / maxTotal) * 100).toFixed(1)}%"></i></span>
          <span class="term-v"><strong>${cedi.format(o.monthly)}</strong>/mo<small>${cedi.format(o.total)} total</small></span>
        </button>`).join('');

      body.innerHTML = rows.map((row) =>
        `<tr><td>Month ${row.m}</td><td>${cedi2.format(row.pay)}</td><td>${cedi2.format(row.principal)}</td><td>${cedi2.format(row.interest)}</td><td>${cedi2.format(row.bal)}</td></tr>`).join('');
    });
  }

  // Eligibility checker -------------------------------------------------------
  const ELIG_QUESTIONS = [
    { id: 'employer', q: 'Where do you work?', options: [
      ['fi', 'Bank or financial institution', 'bank'],
      ['soe', 'State-owned enterprise (SOE)', 'building'],
      ['salaried', 'Other salaried employer', 'briefcase'],
      ['self', 'Self-employed / not employed', 'smile'],
    ] },
    { id: 'bank', q: 'Is your salary paid into a bank account?', options: [['yes', 'Yes, it is', 'check'], ['no', 'No, cash or MoMo', 'cash']] },
    { id: 'card', q: 'Do you have a valid Ghana Card?', options: [['yes', 'Yes, I do', 'id'], ['no', 'Not yet', 'clock']] },
    { id: 'docs', q: 'Can you get 6 months’ bank statements and 3 months’ payslips?', options: [['yes', 'Yes, easily', 'doc'], ['no', 'I’m not sure', 'alert']] },
    { id: 'guarantor', q: 'Can you provide a guarantor and post-dated cheques?', options: [['yes', 'Yes, I can', 'family'], ['no', 'Not sure yet', 'alert']] },
  ];

  function initEligibility(root) {
    const answers = {};
    let step = 0;
    root.innerHTML = `<div class="stepper-progress" aria-hidden="true"><span></span></div><div data-stage aria-live="polite"></div>`;
    const stage = $('[data-stage]', root), bar = $('.stepper-progress span', root);

    function renderQ() {
      const item = ELIG_QUESTIONS[step];
      bar.style.width = `${(step / ELIG_QUESTIONS.length) * 100}%`;
      const dots = ELIG_QUESTIONS.map((_, i) => `<span class="${i < step ? 'done' : i === step ? 'now' : ''}">${i + 1}</span>`).join('');
      stage.innerHTML = `<div class="q active"><div class="q-steps" aria-label="Question ${step + 1} of ${ELIG_QUESTIONS.length}">${dots}</div>
        <p class="q-title">${item.q}</p>
        <div class="options">${item.options.map(([v, l, ic]) => `<button type="button" class="option" data-v="${v}">${ic ? icon(ic) : ''}<span>${l}</span></button>`).join('')}</div>
        ${step ? '<button type="button" class="q-back" data-back>← Back</button>' : ''}</div>`;
      $$('.option', stage).forEach((b) => b.addEventListener('click', () => {
        answers[item.id] = b.dataset.v;
        step += 1;
        step < ELIG_QUESTIONS.length ? renderQ() : renderResult();
      }));
      $('[data-back]', stage)?.addEventListener('click', () => { step -= 1; renderQ(); });
    }

    function renderResult() {
      bar.style.width = '100%';
      const missing = [];
      if (answers.bank === 'no') missing.push('a bank account that receives your salary');
      if (answers.card === 'no') missing.push('a valid Ghana Card (register at any NIA office)');
      if (answers.docs === 'no') missing.push('6 months’ bank statements and 3 months’ payslips (your bank and HR can provide these)');
      if (answers.guarantor === 'no') missing.push('a guarantor and post-dated cheques covering your repayment period');
      let emoji, title, text, cta;
      if (answers.employer === 'self') {
        emoji = 'book'; title = 'Our loans are built for salaried workers';
        text = 'Right now we lend to people with a regular monthly salary. You can still talk to us. Meanwhile, our free guides can help you plan, save and grow.';
        cta = `<a class="btn btn-primary" href="/learn/">Explore free money guides</a> <a class="btn btn-ghost" href="/contact/">Talk to us</a>`;
      } else if (!missing.length) {
        emoji = 'check';
        title = answers.employer === 'salaried' ? 'Good news — you may qualify!' : 'You look like a great fit!';
        text = answers.employer === 'salaried'
          ? 'We mainly serve staff of financial institutions and SOEs, but we review other salaried workers too. Send us your details and we’ll confirm quickly.'
          : 'Staff of financial institutions and SOEs are exactly who we serve. Apply now and we aim to pay out the same day once your documents check out.';
        text += ' Also have a passport-sized photo ready, and make sure your phone number is registered in your name.';
        cta = `<a class="btn btn-cta btn-lg" href="/apply/">Apply now</a>`;
      } else {
        emoji = 'doc'; title = 'Almost there: get these ready';
        text = `To complete an application you’ll need: <strong>${missing.join('; ')}</strong>. Once you have them, applying takes minutes.`;
        cta = `<a class="btn btn-primary" href="/loans/#requirements">See full requirements</a> <a class="btn btn-ghost" href="/contact/">Ask a question</a>`;
      }
      stage.innerHTML = `<div class="outcome q active"><div class="outcome-icon">${icon(emoji)}</div><h3>${title}</h3><p class="muted">${text}</p>
        <div class="btn-row" style="justify-content:center">${cta}</div>
        <button type="button" class="btn btn-ghost" style="margin-top:12px" data-restart>Start again</button></div>`;
      $('[data-restart]', stage).addEventListener('click', () => { step = 0; renderQ(); });
    }
    renderQ();
  }

  // Application form → WhatsApp / email --------------------------------------
  function initApply(form) {
    const params = new URLSearchParams(location.search);
    const wantMonths = clamp(num(params.get('months')) || CFG.calc.defaultMonths, CFG.calc.minMonths, CFG.calc.maxMonths);
    for (let i = CFG.calc.minMonths; i <= CFG.calc.maxMonths; i++) form.months.add(new Option(months(i), i, false, i === wantMonths));
    form.amount.value = clamp(num(params.get('amount')) || CFG.calc.defaultAmount, CFG.calc.min, CFG.calc.max);

    const rules = {
      fullname: (v) => v.trim().length >= 3 || 'Please enter your full name.',
      phone: (v) => /^(\+?233|0)\d{9}$/.test(v.replace(/[\s-]/g, '')) || 'Enter a valid Ghana number, e.g. 024 123 4567.',
      employer: (v) => v.trim().length >= 2 || 'Tell us where you work.',
      employerType: (v) => !!v || 'Choose your employer type.',
      amount: (v) => (num(v) >= CFG.calc.min && num(v) <= CFG.calc.max) || `Enter an amount between ${cedi.format(CFG.calc.min)} and ${cedi.format(CFG.calc.max)}.`,
      consent: (_, el) => el.checked || 'Please confirm so we can contact you.',
    };
    function validate() {
      let firstBad = null;
      for (const [name, rule] of Object.entries(rules)) {
        const el = form.elements[name]; if (!el) continue;
        const res = rule(el.value, el), field = el.closest('.field') || el.closest('.consent');
        const ok = res === true;
        field?.classList.toggle('invalid', !ok);
        const err = field && $('.field-error', field);
        if (err) err.textContent = ok ? '' : res;
        el.setAttribute('aria-invalid', String(!ok));
        if (!ok && !firstBad) firstBad = el;
      }
      if (firstBad) firstBad.focus();
      return !firstBad;
    }
    $$('input, select, textarea', form).forEach((el) => el.addEventListener('blur', () => {
      const rule = rules[el.name]; if (!rule) return;
      const ok = rule(el.value, el) === true;
      (el.closest('.field') || el.closest('.consent'))?.classList.toggle('invalid', !ok);
      const err = $('.field-error', el.closest('.field') || form); if (err && !ok) err.textContent = rule(el.value, el);
    }));

    function message() {
      const f = form.elements, P = num(f.amount.value), n = num(f.months.value);
      const est = Loan.flat(P, CFG.calc.monthlyRatePct, n);
      return [
        'Hello Sprint Micro-Credit, I would like to apply for a loan.',
        '',
        `Name: ${f.fullname.value.trim()}`,
        `Phone: ${f.phone.value.trim()}`,
        `Employer: ${f.employer.value.trim()} (${f.employerType.options[f.employerType.selectedIndex].text})`,
        f.salary.value ? `Monthly take-home pay: ${cedi.format(num(f.salary.value))}` : null,
        `Loan amount: ${cedi.format(P)}`,
        `Repayment period: ${months(n)} (estimated ${cedi2.format(est.monthly)}/month)`,
        f.purpose.value ? `Purpose: ${f.purpose.value}` : null,
        `Best way to reach me: ${f.contactPref.value}`,
      ].filter((l) => l !== null).join('\n');
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate()) return;
      window.open(waUrl(message()), '_blank', 'noopener');
      $('[data-apply-done]')?.removeAttribute('hidden');
      toast('Opening WhatsApp… just press Send.');
    });
    $('[data-apply-email]', form)?.addEventListener('click', () => {
      if (!validate()) return;
      location.href = `mailto:${CFG.email}?subject=${encodeURIComponent('Loan application – ' + form.fullname.value.trim())}&body=${encodeURIComponent(message())}`;
    });
  }

  // Office open/closed badge (Ghana is on GMT all year, so UTC = local time) ------
  function initOpenStatus(badge) {
    const hours = CFG.hours || [];
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const fmt = (hhmm) => { let [h, m] = hhmm.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap}`; };
    const slotFor = (day) => hours.find((h) => h.days.includes(DAYS[day]));
    const now = new Date(), day = now.getUTCDay(), mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const today = slotFor(day);
    let text, open = false;
    if (today && mins >= toMin(today.opens) && mins < toMin(today.closes)) {
      open = true; text = `Open now · closes ${fmt(today.closes)}`;
    } else {
      // Next opening: later today, or the next day that has hours
      let next = null;
      for (let i = 0; i < 8 && !next; i++) {
        const d = (day + i) % 7, slot = slotFor(d);
        if (slot && (i > 0 || mins < toMin(slot.opens))) next = { d, i, slot };
      }
      text = next ? `Closed now · opens ${next.i === 0 ? 'today' : next.i === 1 ? 'tomorrow' : DAYS[next.d]} ${fmt(next.slot.opens)}` : 'Closed now';
    }
    badge.textContent = text;
    badge.classList.toggle('is-open', open);
    badge.hidden = false;
    $$('.hours tr[data-days]').forEach((tr) => tr.classList.toggle('today', tr.dataset.days.split(',').includes(String(day))));
  }

  // Contact message form -> WhatsApp / email ------------------------------------
  function initContact(form) {
    let topic = $('[data-topic][aria-pressed="true"]', form)?.dataset.topic || '';
    $$('[data-topic]', form).forEach((chip) => chip.addEventListener('click', () => {
      $$('[data-topic]', form).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      topic = chip.dataset.topic;
    }));
    const rules = {
      name: (v) => v.trim().length >= 2 || 'Please tell us your name.',
      message: (v) => v.trim().length >= 5 || 'Please write a short message.',
    };
    function validate() {
      let firstBad = null;
      for (const [name, rule] of Object.entries(rules)) {
        const el = form.elements[name], res = rule(el.value), ok = res === true, field = el.closest('.field');
        field.classList.toggle('invalid', !ok);
        $('.field-error', field).textContent = ok ? '' : res;
        el.setAttribute('aria-invalid', String(!ok));
        if (!ok && !firstBad) firstBad = el;
      }
      if (firstBad) firstBad.focus();
      return !firstBad;
    }
    const message = () => {
      const f = form.elements;
      return [
        'Hello Sprint Micro-Credit,', '',
        `Topic: ${topic}`,
        `Name: ${f.name.value.trim()}`,
        f.phone.value.trim() ? `Phone: ${f.phone.value.trim()}` : null,
        '', f.message.value.trim(),
      ].filter((l) => l !== null).join('\n');
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate()) return;
      window.open(waUrl(message()), '_blank', 'noopener');
      toast('Opening WhatsApp… just press Send.');
    });
    $('[data-contact-email]', form)?.addEventListener('click', () => {
      if (!validate()) return;
      location.href = `mailto:${CFG.email}?subject=${encodeURIComponent(`${topic}: ${form.elements.name.value.trim()}`)}&body=${encodeURIComponent(message())}`;
    });
  }

  // Budget planner ------------------------------------------------------------
  function initBudget(root) {
    const income = $('[data-income]', root);
    const cats = $$('[data-cat]', root);
    const donut = $('[data-budget-donut]', root), legend = $('.legend', root);
    function update() {
      const inc = num(income.value);
      const spent = cats.reduce((t, el) => t + num(el.value), 0);
      const base = Math.max(inc, spent) || 1;
      let at = 0;
      const stops = [];
      legend.innerHTML = '';
      cats.forEach((el) => {
        const v = num(el.value), pct = (v / base) * 100;
        if (v) { stops.push(`${el.dataset.color} ${at.toFixed(2)}% ${(at + pct).toFixed(2)}%`); at += pct; }
        legend.insertAdjacentHTML('beforeend', `<span><i style="background:${el.dataset.color}"></i>${el.dataset.cat}${inc ? ` ${Math.round((v / inc) * 100)}%` : ''}</span>`);
      });
      if (at < 100) stops.push(`var(--alt-50) ${at.toFixed(2)}% 100%`); // unallocated
      donut.style.background = `conic-gradient(${stops.join(', ')})`;
      const left = inc - spent;
      $('[data-out="left2"]', root).textContent = cedi.format(left);
      $('[data-out="spent"]', root).textContent = cedi.format(spent);
      $('[data-out="left"]', root).textContent = cedi.format(left);
      const savings = num($('[data-cat="Savings"]', root)?.value);
      const tip = $('[data-out="tip"]', root);
      if (!inc) tip.textContent = 'Enter your monthly take-home pay to start.';
      else if (left < 0) tip.textContent = `You’re ${cedi.format(-left)} over budget. Trim “wants” first, such as data bundles, eating out and outings.`;
      else if (savings / inc < 0.1) tip.textContent = `Tip: try to save at least 10% (${cedi.format(inc * 0.1)}). Pay yourself first on payday.`;
      else tip.textContent = `Nice! You’re saving ${Math.round((savings / inc) * 100)}% and have ${cedi.format(left)} unallocated. Give every cedi a job.`;
      $('[data-out="needs"]', root).textContent = cedi.format(inc * 0.5);
      $('[data-out="wants"]', root).textContent = cedi.format(inc * 0.3);
      $('[data-out="save"]', root).textContent = cedi.format(inc * 0.2);
    }
    [income, ...cats].forEach((el) => el.addEventListener('input', update));
    update();
  }

  // Flat vs reducing comparison -----------------------------------------------
  function initCompare(root) {
    const P = $('[data-p]', root), R = $('[data-r]', root), N = $('[data-n]', root);
    function update() {
      [R, N].forEach(paintRange);
      const p = num(P.value), r = num(R.value), n = num(N.value);
      $('[data-out="r"]', root).textContent = `${r}% / month`;
      $('[data-out="n"]', root).textContent = months(n);
      const f = Loan.flat(p, r, n), d = Loan.reducing(p, r, n);
      $('[data-out="flat-monthly"]', root).textContent = cedi2.format(f.monthly);
      $('[data-out="flat-interest"]', root).textContent = cedi2.format(f.interest);
      $('[data-out="red-monthly"]', root).textContent = cedi2.format(d.monthly);
      $('[data-out="red-interest"]', root).textContent = cedi2.format(d.interest);
      $('[data-out="diff"]', root).textContent = cedi2.format(Math.max(0, f.interest - d.interest));
      const max = Math.max(f.interest, d.interest) || 1;
      $$('[data-bar]', root).forEach((bar) => {
        const v = bar.dataset.bar === 'flat' ? f.interest : d.interest;
        $('i', bar).style.width = `${(v / max) * 100}%`;
        $('b', bar).textContent = cedi.format(v);
      });
    }
    [P, R, N].forEach((el) => el.addEventListener('input', update));
    update();
  }

  // Emergency fund planner ----------------------------------------------------
  function initEfund(root) {
    const ess = $('[data-ess]', root), have = $('[data-have]', root), save = $('[data-save]', root);
    const chips = $$('.chip', root);
    let target = 3;
    function update() {
      const goal = num(ess.value) * target, gap = Math.max(0, goal - num(have.value)), per = num(save.value);
      $('[data-out="goal"]', root).textContent = cedi.format(goal);
      $('[data-out="gap"]', root).textContent = cedi.format(gap);
      const t = $('[data-out="time"]', root);
      if (!goal) t.textContent = '—';
      else if (!gap) t.textContent = 'You’re there!';
      else if (!per) t.textContent = 'Add a monthly amount';
      else { const m = Math.ceil(gap / per); t.textContent = m > 24 ? `${(m / 12).toFixed(1)} years` : months(m); }
      const pct = goal ? Math.min(100, (num(have.value) / goal) * 100) : 0;
      setPct($('.ring', root), pct);
      $('[data-out="pct"]', root).textContent = `${pct.toFixed(0)}%`;
      $('[data-out="ring-msg"]', root).textContent = `of your ${target}-month safety net is already saved.`;
    }
    chips.forEach((c) => c.addEventListener('click', () => {
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      target = num(c.dataset.months); update();
    }));
    [ess, have, save].forEach((el) => el.addEventListener('input', update));
    update();
  }

  // Money quiz ------------------------------------------------------------------
  const QUIZ = [
    { q: 'You borrow GH₵1,000 at 5% per month “flat” for 6 months. How much interest do you pay?', o: ['GH₵50', 'GH₵300', 'GH₵500'], a: 1, e: 'Flat interest is charged on the original amount every month: 1,000 × 5% × 6 = GH₵300.' },
    { q: 'A “loan officer” on WhatsApp asks for a GH₵200 “processing fee” by MoMo before releasing your loan. What should you do?', o: ['Pay quickly so you don’t lose the offer', 'Stop. Verify the lender through official contacts', 'Send half now, half later'], a: 1, e: 'Upfront-fee requests from strangers are a classic loan scam. Always verify through the lender’s official phone number and office.' },
    { q: 'What share of your take-home pay should loan repayments ideally stay under?', o: ['About 30%', 'About 60%', 'It doesn’t matter'], a: 0, e: 'Keeping all debt repayments under about 30% of take-home pay leaves room for rent, food, transport and savings.' },
    { q: 'How big should an emergency fund be for most salaried workers?', o: ['One week of pay', '3 to 6 months of essential expenses', 'Exactly GH₵1,000'], a: 1, e: 'Aim for 3 months of essential costs first, then build to 6 months. Start small. Even GH₵50 a week adds up.' },
    { q: 'Which is usually the smartest reason to take a short-term loan?', o: ['A genuine emergency or an investment that pays back', 'A party to impress friends', 'Repaying another loan you can’t afford'], a: 0, e: 'Borrow for needs and for things that earn or save you money. Borrowing to repay other debt can trap you in a cycle, so talk to your lender first.' },
    { q: 'Before signing any loan agreement, you should confirm…', o: ['Only the monthly payment', 'Total cost, interest rate, fees and penalties', 'Nothing. Sign fast!'], a: 1, e: 'Always ask for the total amount you’ll repay, the rate, all fees and late-payment charges, in writing.' },
  ];

  function initQuiz(root) {
    let i = 0, score = 0;
    const stage = document.createElement('div'); stage.setAttribute('aria-live', 'polite');
    root.innerHTML = '<div class="stepper-progress" aria-hidden="true"><span></span></div>'; root.append(stage);
    const bar = $('.stepper-progress span', root);
    function render() {
      bar.style.width = `${(i / QUIZ.length) * 100}%`;
      const item = QUIZ[i];
      stage.innerHTML = `<div class="q active"><p class="small muted">Question ${i + 1} of ${QUIZ.length} · Score ${score}</p><p class="q-title">${item.q}</p>
        <div class="options">${item.o.map((t, k) => `<button type="button" class="option" data-k="${k}">${t}</button>`).join('')}</div>
        <div class="explain"></div></div>`;
      $$('.option', stage).forEach((b) => b.addEventListener('click', () => {
        const k = num(b.dataset.k), right = k === item.a;
        if (right) score++;
        $$('.option', stage).forEach((x, idx) => { x.disabled = true; if (idx === item.a) x.classList.add('correct'); });
        if (!right) b.classList.add('wrong');
        const ex = $('.explain', stage);
        ex.innerHTML = `<strong style="color:${right ? 'var(--ok)' : 'var(--danger)'}">${right ? 'Correct!' : 'Not quite.'}</strong> ${item.e}
          <div style="margin-top:12px"><button type="button" class="btn btn-primary" data-next>${i + 1 < QUIZ.length ? 'Next question →' : 'See my score'}</button></div>`;
        ex.classList.add('show');
        $('[data-next]', ex).addEventListener('click', () => { i++; i < QUIZ.length ? render() : done(); });
        $('[data-next]', ex).focus();
      }));
    }
    function done() {
      bar.style.width = '100%';
      const msg = score === QUIZ.length ? 'Money master!' : score >= 4 ? 'Great job!' : 'Good start, keep learning.';
      const share = `I scored ${score}/${QUIZ.length} on the Sprint Micro-Credit money quiz! Test yourself: ${location.origin}/learn/#quiz`;
      stage.innerHTML = `<div class="outcome q active"><div class="outcome-icon">${icon(score >= 4 ? 'trophy' : 'book')}</div>
        <h3>You scored ${score} / ${QUIZ.length}</h3><p class="muted">${msg} Our free guides go deeper on each topic.</p>
        <div class="btn-row" style="justify-content:center"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(share)}">Challenge a friend on WhatsApp</a>
        <button type="button" class="btn btn-ghost" data-again>Try again</button></div></div>`;
      $('[data-again]', stage).addEventListener('click', () => { i = 0; score = 0; render(); });
    }
    render();
  }

  // Share buttons ----------------------------------------------------------------
  function initShare() {
    $$('[data-share]').forEach((b) => b.addEventListener('click', async () => {
      const data = { title: document.title, url: location.href };
      if (navigator.share) { try { await navigator.share(data); } catch { /* user cancelled */ } return; }
      try { await navigator.clipboard.writeText(location.href); toast('Link copied!'); } catch { toast(location.href); }
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    $$('[data-promo]').forEach(initPromo);
    initReveal();
    initShare();
    $$('[data-plan]').forEach(initPlan);
    $$('[data-calc]').forEach(initCalculator);
    $$('[data-elig]').forEach(initEligibility);
    $$('[data-apply]').forEach(initApply);
    $$('[data-contact]').forEach(initContact);
    $$('[data-open-status]').forEach(initOpenStatus);
    $$('[data-budget]').forEach(initBudget);
    $$('[data-compare]').forEach(initCompare);
    $$('[data-efund]').forEach(initEfund);
    $$('[data-quiz]').forEach(initQuiz);
  });
})();
